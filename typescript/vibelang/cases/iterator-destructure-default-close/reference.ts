import {values,events} from "./helper.js"
function boom():number{throw "boom"}
try{const [n=boom()]=values();events.push("body:"+n)}catch{events.push("caught")}
console.log(events.join(","))
