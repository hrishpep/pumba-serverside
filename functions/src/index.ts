import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';
import { _databaseWithOptions } from 'firebase-functions/lib/providers/firestore';
import { _bucketWithOptions } from 'firebase-functions/lib/providers/storage';

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

export const creationTimestamp = functions.firestore.
                            document('/user/{userID}/observations/{observationID}').onCreate((snapshot, context) => {

    const utc = firestore.FieldValue.serverTimestamp()
    let data = snapshot.data()
    data.createTime = utc
                            
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
