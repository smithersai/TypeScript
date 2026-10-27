import {pairs,events} from "./helper.js"
function boom():number{throw "boom"}
try {for(const [n=boom()] of pairs()){events.push("body:"+n)}}catch{events.push("caught")}
console.log("binding",events.join(","))
events.length=0
try{for(const pair of pairs()){const [n=boom()]=pair;events.push("body:"+n)}}catch{events.push("caught")}
console.log("body",events.join(","))
