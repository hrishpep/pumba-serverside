//import { firestore } from 'firebase-admin';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { _databaseWithOptions } from 'firebase-functions/lib/providers/firestore';
import { _bucketWithOptions } from 'firebase-functions/lib/providers/storage';


// https://stackoverflow.com/questions/60262246/firebase-function-error-the-default-firebase-app-does-not-exist
//strangely this needs to be here!
admin.initializeApp();

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

    const utc = admin.firestore.FieldValue.serverTimestamp()
    let data = snapshot.data()
    data.createTime = utc
                            
    return snapshot.ref.set(data)
});

export  const vpkProfileAnalysis = functions.firestore.
                            document('/user/{userID}/vpk/{vpkID}').onCreate((snapshot, context) => {

    const utc = admin.firestore.FieldValue.serverTimestamp()
    let data = snapshot.data()

    console.log('**********')
    console.log(data.answers)
    console.log('**********')

    let vC = 0
    let pC = 0
    let kC = 0
    for(let i of data.answers){

        if(i.answer == 'v')
        vC++
        else if(i.answer == 'p')
        pC++
        else if(i.answer == 'k')
        kC++
    }

    let total = vC+pC+kC;
    console.log(total)
    vC = Math.round(vC/total*100)
    pC = Math.round(pC/total*100)
    kC = Math.round(kC/total*100)
    console.log(vC, pC, kC)

    let helix = 
        [
         {name:"Drive", kMin:0, kMax:25, pMin:75, pMax:100, vMin:0, vMax:25},
         {name:"Spark", kMin:0, kMax:25, pMin:50, pMax:75, vMin:0, vMax:25},
         {name:"Insight", kMin:0, kMax:25, pMin:50, pMax:75, vMin:25, vMax:50},
         {name:"Wisdom", kMin:0, kMax:25, pMin:25, pMax:50, vMin:25, vMax:50},
         {name:"Clarity", kMin:0, kMax:25, pMin:25, pMax:50, vMin:50, vMax:75},
         {name:"Original", kMin:0, kMax:25, pMin:0, pMax:25, vMin:50, vMax:75},
         {name:"Creativity", kMin:0, kMax:25, pMin:0, pMax:25, vMin:75, vMax:100},
         {name:"Passion", kMin:25, kMax:50, pMin:50, pMax:75, vMin:0, vMax:25},
         {name:"Courage", kMin:25, kMax:50, pMin:25, pMax:50, vMin:0, vMax:25},
         {name:"Harmony", kMin:25, kMax:50, pMin:25, pMax:50, vMin:25, vMax:50},
         {name:"Composed", kMin:25, kMax:50, pMin:0, pMax:25, vMin:25, vMax:50},
         {name:"Compassion", kMin:25, kMax:50, pMin:0, pMax:25, vMin:50, vMax:75},
         {name:"Vigor", kMin:50, kMax:75, pMin:25, pMax:50, vMin:0, vMax:25},
         {name:"Resolve", kMin:50, kMax:75, pMin:0, pMax:25, vMin:0, vMax:25},
         {name:"Calm", kMin:50, kMax:75, pMin:0, pMax:25, vMin:25, vMax:50},
         {name:"Strength", kMin:75, kMax:100, pMin:0, pMax:25, vMin:0, vMax:25}
        ] 
    let result = null;
    for(let i of helix)
        if(i.vMin <= vC && vC <= i.vMax && i.pMin <= pC && pC <= i.pMax && i.kMin <= kC && kC <= i.kMax)
            result = i.name


    const _path:string[] = snapshot.ref.path.split('/')
    console.log('/user/'+_path[1]+'/vpk-analysis')
    console.log(_path[3])

    let doc = admin.firestore().collection('/user/'+_path[1]+'/vpk-analysis').doc(_path[3])
    doc.set({
        result: result,
        k: kC,
        p: pC, 
        v: vC,
        utc: utc
    }).then(status => {return true;}, error=> {return true;})

    let doc_count = admin.firestore().collection('/analytics/vpk-count/'+_path[1]).doc(_path[3]) // we do not want to overright the previous user record - so we make document name as user_id + utc
    doc_count.set({
        result: result,
        k: kC,
        p: pC, 
        v: vC,
        utc: utc
    }).then(status => {return true;}, error=> {return true;})
return true;
});

export  const vpk_count_update = functions.firestore.
                            document('/analytics/vpk-count/{userID}/{vpkID}').onCreate((snapshot, context) => {


        const _path:string[] = snapshot.ref.path.split('/')
        let user_latest_rec:any = {};
        let user_previous_rec:any = {};


        admin.firestore().collection('/analytics/vpk-count/'+_path[2]).orderBy('utc','desc').limit(2).get().then((querySnapshot) => {

            querySnapshot.forEach((doc) => {
                console.log('*****: ',doc.data())
                // doc.data() is never undefined for query doc snapshots
                if(!user_latest_rec.id){
                user_latest_rec.id = doc.id
                user_latest_rec.data = doc.data()
                }
                else {
                user_previous_rec.id = doc.id
                user_previous_rec.data = doc.data() 
                }            
            })

            if(user_latest_rec && user_previous_rec && (user_latest_rec.data.result == user_previous_rec.result))
            return; // its the same nothing to do!


            console.log('*****: :*****')
            admin.firestore().collection("/analytics").doc('vpk-count').get().then(doc =>
            {
                // only relevant for the very first user ever using this
                let new_data = doc.data();
                if(!new_data)
                    new_data = {}
    
                console.log('1::: ' , user_latest_rec)
                console.log('2::: ' , user_previous_rec)
                // only relevant when a category is getting value for the very first time
                if(new_data[user_latest_rec.data.result])
                new_data[user_latest_rec.data.result] =  new_data[user_latest_rec.data.result] + 1;
                else  new_data[user_latest_rec.data.result] =  1;
    
                if(user_previous_rec.data) { // only run decrement if user previously had data
                new_data[user_previous_rec.data.result] =  new_data[user_previous_rec.data.result] - 1;
                }
                
                admin.firestore().collection("/analytics").doc('vpk-count').set(new_data).then(
                    success=> {  console.log('success') }, error=> { console.log(error)}
                )
                
            }, error => { console.log(error)});


            }, error => { console.log(error)}
        );
        
        return true;
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
