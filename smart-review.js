/* Adaptive ADS1 quiz. Session-only results; no account writes or external AI service. */
(function(){
"use strict";
const bank=[
{id:"a1",topic:"Algorithms",level:1,prompt:"Which description best defines an algorithm?",choices:["A finite sequence of clear steps to solve a problem","A programming language only computers understand","A list of random values"],answer:0,why:"An algorithm is a finite, ordered set of precise steps that transforms inputs into a result."},
{id:"a3",topic:"Algorithms",level:3,prompt:"A recipe says “cook until it looks right.” What is the main weakness?",choices:["The stopping condition is not precise","It has too many inputs","It must be written in C"],answer:0,why:"Algorithm steps should be unambiguous. “Looks right” does not give a precise stopping condition."},
{id:"p1",topic:"Problem solving",level:1,prompt:"In Input–Processing–Output, which part receives values supplied by a user?",choices:["Input","Processing","Output"],answer:0,why:"Input is the data a problem receives. Processing acts on it, and output is the result."},
{id:"p3",topic:"Problem solving",level:3,prompt:"A program reads two numbers, adds them, then displays the sum. What is the processing step?",choices:["Reading the numbers","Adding the numbers","Displaying the sum"],answer:1,why:"Addition is the operation performed on the inputs, so it is the processing step."},
{id:"v1",topic:"Variables",level:1,prompt:"What is a variable used for in an algorithm?",choices:["To name a value that can be used or changed","To mark the end of every program","To display text automatically"],answer:0,why:"A variable names a value so an algorithm can refer to or update it."},
{id:"v3",topic:"Variables",level:3,prompt:"Start with x = 4, then execute x = x + 3. What is x afterward?",choices:["3","4","7"],answer:2,why:"The right side uses the old value 4, adds 3, then assigns 7 back to x."},
{id:"s1",topic:"Sequence",level:1,prompt:"In a sequential algorithm, what determines the order of execution?",choices:["The order of the instructions","The length of each instruction","The screen size"],answer:0,why:"A sequential algorithm executes instructions one after another in their written order."},
{id:"s3",topic:"Sequence",level:3,prompt:"To calculate total = price × quantity, then display total, what happens first?",choices:["Display total","Calculate total","Order never matters"],answer:1,why:"Calculate and store the value before displaying it."},
{id:"t1",topic:"Data types",level:1,prompt:"Which type is most suitable for a whole number such as 12?",choices:["Integer","Boolean","Text"],answer:0,why:"An integer represents a whole number; Boolean represents true/false, and text represents characters."},
{id:"t3",topic:"Data types",level:3,prompt:"A variable stores whether a student passed (yes/no). Which type fits best?",choices:["Integer","Boolean","Decimal"],answer:1,why:"A Boolean stores one of two logical values, such as passed/not passed."},
{id:"q1",topic:"Pseudocode",level:1,prompt:"Why do learners use pseudocode?",choices:["To describe algorithm steps without strict programming syntax","To make code run faster","To replace testing"],answer:0,why:"Pseudocode focuses on the logic and stays readable without a specific language’s syntax."},
{id:"q3",topic:"Pseudocode",level:3,prompt:"Which order correctly computes and reports a rectangle’s area?",choices:["Display area; area ← length × width","area ← length × width; display area","width ← display; length ← area"],answer:1,why:"First calculate and assign the area, then display the calculated value."}
];
let state=null;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function card(){return '<article class="smart-review-card"><div><span class="eyebrow">Adaptive practice</span><h2>Smart review</h2><p>A short ADS1 quiz adapts to your answers and explains each one.</p></div><a class="button" href="#arena/review">Start a review <span aria-hidden="true">→</span></a></article>';}
function render(){
 const crumb=typeof crumbs==="function"?crumbs([{label:"Home",href:"#home"},{label:"Arena",href:"#arena"},{label:"Smart review"}]):'<p><a href="#arena">← Back to Algo Arena</a></p>';
 if(!state)return '<section class="container arena-shell fade-in smart-review">'+crumb+'<span class="eyebrow">Adaptive practice · ADS1</span><h1>Smart review</h1><p class="arena-intro">Answer a short question set. Correct answers raise the challenge; an incorrect answer brings a gentler check on the same idea.</p><section class="review-finish"><p>Six quick questions based on ADS1 lessons. Results stay in this browser session and are not added to your account.</p><button type="button" class="button" data-review="start">Begin review</button></section></section>';
 if(!state.q)return '<section class="container arena-shell fade-in smart-review">'+crumb+'<span class="eyebrow">Adaptive practice · ADS1</span><h1>Smart review</h1><section class="review-finish" role="status"><h2>Review complete</h2><p>You answered '+state.score+' of '+state.used.length+' correctly.</p><button type="button" class="button" data-review="start">Try another review</button></section></section>';
 const q=state.q, answered=state.choice!==null, questionNo=state.used.length+(answered?0:1);
 const buttons=q.choices.map(function(c,i){let cls="review-choice";if(answered&&i===q.answer)cls+=" correct";else if(answered&&i===state.choice)cls+=" incorrect";return '<button type="button" class="'+cls+'" data-answer="'+i+'" '+(answered?"disabled":"")+ '>'+esc(c)+(answered&&i===q.answer?' <span aria-hidden="true">✓</span>':"")+'</button>';}).join("");
 const feedback=answered?'<div class="review-explanation '+(state.choice===q.answer?"is-correct":"is-incorrect")+'" role="status"><strong>'+(state.choice===q.answer?"Correct!":"Not quite.")+'</strong><span>'+esc(q.why)+'</span><button type="button" class="button" data-review="next">'+(state.used.length>=6?"See result":"Next question")+' <span aria-hidden="true">→</span></button></div>':"";
 return '<section class="container arena-shell fade-in smart-review">'+crumb+'<span class="eyebrow">Adaptive practice · ADS1</span><h1>Smart review</h1><p class="arena-intro">Answer a short question set. Correct answers raise the challenge; an incorrect answer brings a gentler check on the same idea.</p><section class="review-question"><div class="review-progress"><span>Question '+questionNo+' of 6</span><span>'+state.score+' correct</span></div><progress value="'+state.used.length+'" max="6" aria-label="Review progress"></progress><span class="review-topic">'+esc(q.topic)+'</span><h2>'+esc(q.prompt)+'</h2><div class="review-choices" role="group" aria-label="Answer choices">'+buttons+'</div>'+feedback+'</section></section>';
}
function start(){state={used:[],score:0,q:bank.find(function(q){return q.level===1;}),choice:null};}
function next(wasCorrect){
 const unused=bank.filter(function(q){return state.used.indexOf(q.id)<0;});
 if(!unused.length||state.used.length>=6){state.q=null;return;}
 const same=unused.filter(function(q){return q.topic===state.q.topic;});
 let pool=same.filter(function(q){return wasCorrect?q.level>state.q.level:q.level<state.q.level;});
 const target=wasCorrect?state.q.level+1:Math.max(1,state.q.level-1);
 if(!pool.length)pool=unused;
 pool.sort(function(a,b){return Math.abs(a.level-target)-Math.abs(b.level-target);});
 state.q=pool[0];state.choice=null;
}
function bind(){
 const root=document.querySelector("#app .smart-review");if(!root||root.dataset.reviewBound)return;
 root.dataset.reviewBound="true";
 root.addEventListener("click",function(event){
  const action=event.target.closest("[data-review]");
  if(action&&action.dataset.review==="start"){start();root.outerHTML=render();bind();return;}
  if(action&&action.dataset.review==="next"){const correct=state.choice===state.q.answer;next(correct);root.outerHTML=render();bind();return;}
  const answer=event.target.closest("[data-answer]");
  if(answer&&state&&state.q&&state.choice===null){const i=Number(answer.dataset.answer);state.choice=i;state.used.push(state.q.id);if(i===state.q.answer)state.score++;root.outerHTML=render();bind();}
 });
}
function install(){
 const api=window.ADS1ArenaUI;if(!api||api.__smartReview)return false;
 const originalView=api.view,originalBind=api.bind;
 api.view=function(){if(location.hash==="#arena/review")return render();const html=originalView();return location.hash==="#arena"?html.replace('<div class="track-grid">',card()+'<div class="track-grid">'):html;};
 api.bind=function(){if(location.hash==="#arena/review"){bind();return;}originalBind();};
 api.__smartReview=true;return true;
}
const css=document.createElement("style");
css.textContent=".smart-review-card{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:18px 0 22px;padding:22px 24px;background:linear-gradient(115deg,var(--pale),var(--white));border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:8px}.smart-review-card h2{margin:4px 0 6px;font-size:22px}.smart-review-card p{margin:0;max-width:580px;color:var(--muted);line-height:1.65}.smart-review-card .eyebrow{display:block}.smart-review{max-width:820px}.review-question,.review-finish{padding:clamp(18px,4vw,30px);background:var(--white);border:1px solid var(--line);border-top:3px solid var(--blue);border-radius:8px;box-shadow:var(--shadow)}.review-progress{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:14px;font-weight:700}.review-question progress{display:block;width:100%;height:10px;margin:12px 0 24px;accent-color:var(--blue)}.review-topic{display:inline-block;padding:5px 9px;color:var(--blue);background:var(--pale);border-radius:999px;font-size:13px;font-weight:800}.review-question h2{margin:14px 0 20px;line-height:1.4;font-size:clamp(20px,3vw,27px)}.review-choices{display:grid;gap:10px}.review-choice{min-height:52px;padding:13px 15px;text-align:left;color:var(--ink);background:var(--white);border:1px solid var(--line);border-radius:6px;cursor:pointer;line-height:1.5}.review-choice:hover:not(:disabled){border-color:var(--blue);background:var(--pale)}.review-choice:focus-visible,.smart-review button:focus-visible,.smart-review-card a:focus-visible{outline:3px solid #20b8e6;outline-offset:3px}.review-choice.correct{border-color:var(--green);background:color-mix(in srgb,var(--green) 12%,var(--white))}.review-choice.incorrect{border-color:#c44;background:color-mix(in srgb,#c44 10%,var(--white))}.review-explanation{display:grid;grid-template-columns:1fr auto;gap:10px 18px;align-items:center;margin-top:18px;padding:16px;border-radius:6px;line-height:1.65}.review-explanation strong{display:block}.review-explanation span{grid-column:1}.review-explanation.is-correct{color:var(--green);background:color-mix(in srgb,var(--green) 11%,var(--white))}.review-explanation.is-incorrect{color:#a23b3b;background:color-mix(in srgb,#c44 9%,var(--white))}.review-explanation button{grid-column:2;grid-row:1 / span 2}.review-finish p{color:var(--muted)}@media(max-width:600px){.smart-review-card{align-items:stretch;flex-direction:column;padding:18px}.smart-review-card .button{align-self:flex-start}.review-explanation{grid-template-columns:1fr}.review-explanation button{grid-column:auto;grid-row:auto;justify-self:start}}";
document.head.append(css);
if(!install())document.addEventListener("DOMContentLoaded",install,{once:true});
})();