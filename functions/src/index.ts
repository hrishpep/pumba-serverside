import { firestore } from 'firebase-admin';
import admin = require('firebase-admin');
import * as functions from 'firebase-functions';

admin.initializeApp();
const fs = admin.firestore()
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

export const makeSearchTextArray = functions.firestore.
            document('symptom/{symptomID}').onCreate((snapshot, context) => {

                functions.logger.log(snapshot.data())
                functions.logger.log(context) 

                return snapshot.ref.set(snapshot.data())
            });

export const updateSearchTextArray = functions.firestore.
                            document('symptom/{symptomID}').onUpdate((snapshot, context) => {

    const TOKEN_KEY:string = '_search_tokens'

    // we create an internal function for recursion sake. 
    const helper_recursive_function = function(obj:any, arr:any[]): any[] {
        let update_array = [...arr]
        for (const key of Object.keys(obj)) {
            if(typeof obj[key] === 'string') {
                //concat does not do an inplace-edit to the array so we have to assign it back to the array
                update_array = update_array.concat(obj[key].toLowerCase().split(" "))
            }
            else if (typeof obj[key] === 'object') {
                update_array = helper_recursive_function(obj[key],update_array)
            }
          }
          return update_array;
    }
    // END helper function

    let original_data =snapshot.after.data();
    //if data already has a tokens array - donot consider that for creation of the array itself
    let data = Object.assign({}, original_data)
    delete data[TOKEN_KEY]

    let all_string_tokens_in_data:any[] = []
    all_string_tokens_in_data = helper_recursive_function(data,all_string_tokens_in_data)


    // prevent infinite recursion
    if(original_data && original_data[TOKEN_KEY]) {
        const original_tokens = original_data[TOKEN_KEY]

        const _a = new Array(original_tokens);
        const _b = new Array(all_string_tokens_in_data);

        if(_a.toString() == _b.toString())
            return null; // no need to update the data - stop the infinite loop
            // this is the recommended method https://firebase.google.com/docs/functions/firestore-events
        
    }

    original_data[TOKEN_KEY] = all_string_tokens_in_data
    return snapshot.after.ref.set(data, {merge:true})
});


/**
 * It can take up to 10 seconds for a function to respond to changes in Cloud Firestore.
 * Ordering is not guaranteed. Rapid changes can trigger function invocations in an unexpected order.
 * Events are delivered at least once, but a single event may result in multiple function invocations. Avoid depending on exactly-once mechanics, and write idempotent functions.
 * Cloud Firestore triggers for Cloud Functions is available only for Cloud Firestore in Native mode. It is not available for Cloud Firestore in Datastore mode.
 */
export const creationTimestamp = functions.firestore.
                            document('/user/{userID}/observations/{observationID}').onCreate((snapshot, context) => {

    const utc = firestore.FieldValue.serverTimestamp()
    let data = snapshot.data()
    data.createTime = utc;
    data.latest = true;
                         
    const user:string = context.params.userID;
    const sym_doc_id:string = data.sym_doc_id;


    fs.collection('/user/'+user+'/observations')
        .where('latest','==',true).where('sym_doc_id','==',sym_doc_id).
        get().then(
        querySnapshot => {
            querySnapshot.forEach( docSnap => {
                if(docSnap.id != snapshot.id) // this is important becasue what will happen is that 
                                              // by the time this query is executed the newly created
                                              // object may already be marked as latest which means that 
                                              // now there are two "latest=true" objects
                docSnap.ref.set({latest:false},{merge:true}).then( s=>{ console.log() }, e=>{ console.log()})
            })
        },
        error => console.log(error)
    )

    return snapshot.ref.set(data)
});


/*****
 * No reason to update
 * Also remember that for all onUpdate functions, you must take care that the 
 * function is not called in an infinite loop. In the below function that is not being checked
 
export const updateTimestamp = functions.firestore.
                            document('/user/{userID}/observations/{observationID}').onUpdate((snapshot, context) => {

    const utc = firestore.FieldValue.serverTimestamp()
    let data = snapshot.after.data()
    data.updateTime = utc
                            
    return snapshot.after.ref.set(data)
});
*/
