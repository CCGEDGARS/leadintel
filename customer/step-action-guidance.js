(function installStepActionGuidance(){
  'use strict';
  if(typeof document==='undefined')return;
  const guidance={
    1:['Add your company website and target market','Enter your website, select the market where you want to find customers, then continue to Profile.'],
    3:['Review and approve your company profile','Check the evidence and commercial answers, make any corrections, then approve the profile to continue.'],
    4:['Review your strategy and choose research depth','Check the recommended customers and buying signals, run the market research you need, then activate your strategy.'],
    6:['Prepare and approve a relevant message','Choose a saved opportunity, build its dossier, review the draft, and approve the message before delivery.'],
    7:['Send the approved message and record the outcome','Choose an approved opportunity, confirm delivery yourself, then record replies and real sales progress.']
  };
  function insert(section,title,detail){
    let banner=section.querySelector(':scope > .step-action-guidance');
    if(!banner){banner=document.createElement('div');banner.className='step-action-guidance';banner.setAttribute('role','note');banner.innerHTML='<span class="step-action-label">What to do now</span><strong></strong><p></p>';section.prepend(banner);}
    if(banner.querySelector('strong').textContent!==title)banner.querySelector('strong').textContent=title;
    if(banner.querySelector('p').textContent!==detail)banner.querySelector('p').textContent=detail;
  }
  function sync(){
    const research=document.getElementById('research-summary'),profileHero=document.querySelector('#step-2 > .hero-copy');
    if(research&&profileHero){
      const complete=research.dataset.researchState==='complete';
      if(complete){
        const step2=document.getElementById('step-2');
        insert(step2,'Review the drafted answers, then open Profile review','Check the AI suggestions and fill any gaps. When ready, press Review your Profile at the end of this page.');
        const banner=step2.querySelector(':scope > .step-action-guidance');
        if(banner&&!banner.querySelector('.step-guidance-jump')){
          const button=document.createElement('button');button.type='button';button.className='secondary-btn step-guidance-jump';button.textContent='Review draft answers ↓';
          button.addEventListener('click',()=>step2.querySelector('[data-brief-group]')?.scrollIntoView({behavior:'smooth',block:'start'}));banner.append(button);
        }
        research.classList.remove('step-action-research');
        if(profileHero.nextElementSibling!==research)profileHero.after(research);
      }else{
        document.querySelector('#step-2 > .step-action-guidance')?.remove();
        if(research.nextElementSibling!==profileHero)profileHero.before(research);
        research.classList.add('step-action-research');
      }
    }
    for(const [step,copy] of Object.entries(guidance)){
      const section=document.getElementById(`step-${step}`);if(!section)continue;
      if(step==='3'){
        const content=document.getElementById('profile-content');if(content)insert(content,...copy);
      }else insert(section,...copy);
    }
    const discovery=document.getElementById('step-5');if(discovery){
      const buyers=document.getElementById('discovery-stage-kicker')?.textContent?.includes('Buyers');
      insert(discovery,...(buyers
        ?['Find decision makers at a saved company','Choose a company in the saved list and press Find buyers. Review the people and verify contacts before writing.']
        :['Find and select relevant companies','Run company discovery, review the evidence and scores, then save the companies you want to pursue.']));
    }
  }
  let scheduled=false;
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});}
  function start(){sync();new MutationObserver(schedule).observe(document.querySelector('main.content')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-research-state']});window.addEventListener('leadintel:module-opened',schedule);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
