(()=>{var d=`
<div class="wcv-overlay" part="overlay">
  <div class="wcv-modal" role="dialog" aria-modal="true" aria-labelledby="wcv-t" aria-describedby="wcv-b">
    <button class="wcv-close" type="button" aria-label="Close">&#215;</button>
    <h2 class="wcv-title" id="wcv-t">Get 10% off your first order</h2>
    <p class="wcv-body" id="wcv-b">Join 12,000 readers. One email a week, no noise.</p>
    <form class="wcv-form" novalidate>
      <input class="wcv-input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
      <button class="wcv-submit" type="submit">Send me the code</button>
    </form>
    <p class="wcv-fine">No spam. Unsubscribe any time.</p>
  </div>
</div>`,p=`
@font-face {
  font-family: 'WCV Fraunces';
  src: url('@FONT@') format('woff2');
  font-weight: 700;
  font-display: block;
}
/* Nothing load-bearing lives on the root itself. On a shadow host that is not a
   nicety: a normal declaration in the OUTER tree beats a normal :host rule, so
   anything the design depends on here is a rule the theme is allowed to win. */
@R@ {
  display: block;
}
@R@ .wcv-overlay {
  position: fixed;
  inset: 0;
  z-index: @Z@;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 14, 20, 0.62);
  padding: 24px;
  box-sizing: border-box;
  /* The base every descendant inherits from. Declared explicitly so the design
     never depends on what the surrounding document happens to be inheriting --
     without this, "leakage" and "the reference has no theme" are the same delta. */
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: normal;
  color: rgb(24, 27, 34);
  text-align: start;
  text-transform: none;
}
@R@ .wcv-modal {
  position: relative;
  box-sizing: border-box;
  width: 440px;
  max-width: 100%;
  padding: 36px 34px 28px;
  background: rgb(255, 255, 255);
  border: 0 solid transparent;
  border-radius: 14px;
  box-shadow: rgba(9, 11, 16, 0.28) 0px 24px 64px 0px;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: rgb(24, 27, 34);
  text-align: start;
  letter-spacing: normal;
  margin: 0;
}
@R@ .wcv-close {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 0;
  border: 0 solid transparent;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0);
  color: rgb(120, 126, 138);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 20px;
  font-weight: 400;
  line-height: 32px;
  text-align: center;
  text-transform: none;
  letter-spacing: normal;
  cursor: pointer;
  box-shadow: none;
  box-sizing: border-box;
}
@R@ .wcv-title {
  margin: 0 0 10px;
  padding: 0;
  font-family: 'WCV Fraunces', Georgia, serif;
  font-size: 27px;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(17, 19, 25);
  text-transform: none;
  letter-spacing: -0.4px;
  text-align: start;
}
@R@ .wcv-body {
  margin: 0 0 22px;
  padding: 0;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.55;
  color: rgb(88, 94, 106);
  text-align: start;
  letter-spacing: normal;
}
@R@ .wcv-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0 solid transparent;
}
@R@ .wcv-input {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  margin: 0;
  border: 1px solid rgb(206, 211, 221);
  border-radius: 9px;
  background: rgb(255, 255, 255);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 44px;
  color: rgb(24, 27, 34);
  text-align: start;
  text-transform: none;
  letter-spacing: normal;
  box-shadow: none;
  outline-offset: 0px;
  -webkit-appearance: none;
  appearance: none;
}
@R@ .wcv-submit {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 18px;
  margin: 0;
  border: 0 solid transparent;
  border-radius: 9px;
  background: rgb(29, 58, 214);
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 46px;
  color: rgb(255, 255, 255);
  text-align: center;
  text-transform: none;
  letter-spacing: 0.1px;
  cursor: pointer;
  box-shadow: none;
  -webkit-appearance: none;
  appearance: none;
}
@R@ .wcv-fine {
  margin: 14px 0 0;
  padding: 0;
  font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  color: rgb(140, 146, 158);
  text-align: center;
  text-transform: none;
  letter-spacing: normal;
}`;function x(g,b){let o=document.createElement("iframe");o.title="Get 10% off your first order",o.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646;background:transparent";let r=document.documentElement;o.srcdoc='<!doctype html><html dir="'+(r.getAttribute("dir")||"ltr")+'" lang="'+(r.getAttribute("lang")||"en")+'"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}'+p.replace(/@R@/g,"html").replace(/@FONT@/g,g).replace(/@Z@/g,"2147483647")+"</style></head><body>"+d+"</body></html>";let a=document.activeElement,s=[],n=()=>{s.forEach(e=>e.removeAttribute("inert")),o.remove(),a&&a.focus()};o.addEventListener("load",()=>{let e=o.contentDocument,l=()=>e.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])'),f=t=>{if(t.key==="Escape")return n();if(t.key!=="Tab")return;let i=l(),c=Array.prototype.indexOf.call(i,e.activeElement);(t.shiftKey?c<=0:c===i.length-1)&&(t.preventDefault(),i[t.shiftKey?i.length-1:0].focus())};e.addEventListener("keydown",f),document.addEventListener("keydown",t=>{t.key==="Escape"&&n()}),e.querySelector(".wcv-close").addEventListener("click",n),e.querySelector(".wcv-form").addEventListener("submit",t=>{t.preventDefault(),b(e.querySelector(".wcv-input").value)}),l()[0].focus()}),document.body.appendChild(o);for(let e of document.body.children)e!==o&&(e.setAttribute("inert",""),s.push(e));return n}})();
