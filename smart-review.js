/* Adaptive review for ADS1: session-only, authored questions, no AI service or account writes. */
(function(){
  "use strict";
  const questions = [
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
    {id:"q1",topic:"Pseudocode",level:1,prompt:"Why do learners use pseudocode?",choices:["To describe algorithm steps without strict programming syntax","To make code run faster","To replace testing"],answer:0,why:"Pseudocode focuses on the logic and stays readable without a specific language's syntax."},
    {id:"q3",topic:"Pseudocode",level:3,prompt:"Which order correctly computes and reports a rectangle’s area?",choices:["Display area; area ← length × width","area ← length × width; display area","width ← display; length ← area"],answer:1,why:"First calculate and assign the area, then display the calculated value."}
  ];
  let state = null;
  const app = document.getElementById("app");
  const css = document.createElement("style");
  css.textContent = ".smart-review-card{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:18px 0 22px;padding:22px 24px;background:linear-gradient(115deg,var(--pale),var(--white));border:1px solid var(--line);border-left:4px solid var(--blue);border-radius:8px}.smart-review-card h2{margin:4px 0 6px;font-size:22px}.smart-review-card p{margin:0;max-width:580px;color:var(--muted);line-height:1.65}.smart-review-card .eyebrow{display:block}.smart-review{max-width:820px}.review-back{display:inline-block;margin:8px 0 20px;color:var(--blue);font-weight:700}.review-question,.review-finish{padding:clamp(18px,4vw,30px);background:var(--white);border:1px solid var(--line);border-top:3px solid var(--blue);border-radius:8px;box-shadow:var(--shadow)}.review-progress{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:14px;font-weight:700}.review-question progress{display:block;width:100%;height:10px;margin:12px 0 24px;accent-color:var(--blue)}.review-topic{display:inline-block;padding:5px 9px;color:var(--blue);background:var(--pale);border-radius:999px;font-size:13px;font-weight:800}.review-question h2{margin:14px 0 20px;line-height:1.4;font-size:clamp(20px,3vw,27px)}.review-choices{display:grid;gap:10px}.review-choice{min-height:52px;padding:13px 15px;text-align:left;color:var(--ink);background:var(--white);border:1px solid var(--line);border-radius:6px;cursor:pointer;line-height:1.5}.review-choice:hover:not(:disabled){border-color:var(--blue);background:var(--pale)}.review-choice:focus-visible,.smart-review button:focus-visible,.smart-review-card a:focus-visible{outline:3px solid #20b8e6;outline-offset:3px}.review-choice.correct{border-color:var(--green);background:color-mix(in srgb,var(--green) 12%,var(--white))}.review-choice.incorrect{border-color:#c44;background:color-mix(in srgb,#c44 10%,var(--white))}.review-explanation{display:grid;grid-template-columns:1fr auto;gap:10px 18px;align-items:center;margin-top:18px;padding:16px;border-radius:6px;line-height:1.65}.review-explanation strong{display:block}.review-explanation.is-correct{color:var(--green);background:color-mix(in srgb,var(--green) 11%,var(--white))}.review-explanation.is-incorrect{color:#a23b3b;background:color-mix(in srgb,#c44 9%,var(--white))}.review-explanation button{grid-column:2;grid-row:1 / span 2}.review-finish p{color:var(--muted)}@media(max-width:600px){.smart-review-card{align-items:stretch;flex-direction:column;padding:18px}.smart-review-card .button{align-self:flex-start}.review-explanation{grid-template-columns:1fr}.review-explanation button{grid-column:auto;grid-row:auto;justify-self:start}}";
  document.head.append(css);

  function make(tag, cls, text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
  function shell(){return app.querySelector(".arena-shell");}
  function card(){
    const root=shell(); if(!root||root.querySelector(".smart-review-card"))return;
    const box=make("article","smart-review-card"), copy=document.createElement("div"), eyebrow=make("span","eyebrow","Adaptive practice");
    copy.append(eyebrow,make("h2","", "Smart review"),make("p","", "A short ADS1 quiz adapts to your answers and explains each one."));
    const link=make("a","button","Start a review →");link.href="#arena/review";box.append(copy,link);
    const tracks=root.querySelector(".track-grid");if(tracks)root.insertBefore(box,tracks);else root.append(box);
  }
  function pickNext(correct){
    const unused=questions.filter(q=>!state.used.includes(q.id));
    if(!unused.length||state.used.length>=6){state.q=null;return;}
    const topic=state.q.topic, same=unused.filter(q=>q.topic===topic);
    let pool=same.filter(q=>correct?q.level>state.q.level:q.level<state.q.level);
    const target=correct?state.q.level+1:Math.max(1,state.q.level-1);
    if(!pool.length)pool=unused;
    pool.sort((a,b)=>Math.abs(a.level-target)-Math.abs(b.level-target));
    state.q=pool[0];state.choice=null;
  }
  function renderReview(){
    const root=make("section","container arena-shell fade-in smart-review");
    const crumb=make("p","content-note");crumb.innerHTML='<a href="#home">Home</a> / <a href="#arena">Algo Arena</a> / Smart review';
    root.append(crumb,make("span","eyebrow","Adaptive practice · ADS1"),make("h1","","Smart review"),make("p","arena-intro","Answer a short question set. Correct answers raise the challenge; an incorrect answer brings a gentler check on the same idea."));
    const back=make("a","review-back","← Back to Algo Arena");back.href="#arena";root.append(back);
    if(!state){
      root.append(make("p","","Six quick questions based on ADS1 lessons. Results stay in this browser session and are not added to your account."));
      const start=make("button","button","Begin review");start.type="button";start.onclick=()=>{state={used:[],score:0,q:questions.find(q=>q.level===1),choice:null};renderRoute();};root.append(start);
    }else if(!state.q){
      const finish=make("section","review-finish");finish.setAttribute("role","status");finish.append(make("h2","","Review complete"),make("p","", "You answered "+state.score+" of "+state.used.length+" correctly."));
      const again=make("button","button","Try another review");again.type="button";again.onclick=()=>{state=null;renderRoute();};finish.append(again);root.append(finish);
    }else{
      const q=state.q, panel=make("section","review-question"), row=make("div","review-progress");
      row.append(make("span","","Question "+(state.used.length+(state.choice===null?1:0))+" of 6"),make("span","",state.score+" correct"));
      const progress=document.createElement("progress");progress.max=6;progress.value=state.used.length;progress.setAttribute("aria-label","Review progress");
      panel.append(row,progress,make("span","review-topic",q.topic),make("h2","",""));
      panel.lastChild.id="review-prompt";panel.lastChild.textContent=q.prompt;
      const choices=make("div","review-choices");choices.setAttribute("role","group");choices.setAttribute("aria-label","Answer choices");
      q.choices.forEach((label,i)=>{const b=make("button","review-choice",label);b.type="button";b.disabled=state.choice!==null;b.setAttribute("aria-pressed",state.choice===i?"true":"false");
        if(state.choice!==null&&i===q.answer)b.classList.add("correct");else if(state.choice===i)b.classList.add("incorrect");
        b.onclick=()=>{if(state.choice!==null)return;state.choice=i;state.used.push(q.id);if(i===q.answer)state.score++;renderRoute();};choices.append(b);});
      panel.append(choices);
      if(state.choice!==null){const exp=make("div","review-explanation "+(state.choice===q.answer?"is-correct":"is-incorrect"));exp.setAttribute("role","status");exp.append(make("strong","",state.choice===q.answer?"Correct!":"Not quite."),document.createTextNode(" "+q.why));
        const next=make("button","button",state.used.length>=6?"See result":"Next question →");next.type="button";next.onclick=()=>{pickNext(state.choice===q.answer);renderRoute();};exp.append(next);panel.append(exp);}
      root.append(panel);
    }
    const old=shell();if(old)old.replaceWith(root);else app.append(root);
    root.focus?.({preventScroll:true});
  }
  function renderRoute(){
    if(location.hash==="#arena/review"){renderReview();return;}
    const root=shell();
    if(root&&location.hash==="#arena")card();
  }
  window.addEventListener("hashchange",()=>setTimeout(renderRoute,0));
  document.addEventListener("DOMContentLoaded",()=>setTimeout(renderRoute,80));
  setTimeout(renderRoute,250);
})();