import {customArray,subclassArray,proxyArray,events} from "./helper.js"
function boom():never{throw "boom"}
try{for(const n of customArray()){boom()}}catch{events.push("caught")}
console.log("array",events.join(","))
events.length=0
const iterable:Iterable<number>=customArray()
try{for(const n of iterable){boom()}}catch{events.push("caught")}
console.log("iterable",events.join(","))

 events.length = 0
 try { for (const n of subclassArray()) { boom() } } catch { events.push("caught") }
 console.log("subclass", events.join(","))
 events.length = 0
 try { for (const n of proxyArray()) { boom() } } catch { events.push("caught") }
 console.log("proxy", events.join(","))
