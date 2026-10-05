from pathlib import Path

p = Path("site/index.html")
s = p.read_text(encoding="utf-8")

s = s.replace(
    "#services .service:nth-child(1){background-image:linear-gradient(145deg,#252a30,#4a525b)}\n#services .service:nth-child(2){background-image:linear-gradient(145deg,#20252b,#59636d)}\n#services .service:nth-child(3){background-image:linear-gradient(145deg,#252a30,#68727b)}",
    "#services .service:nth-child(1){background-image:url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82')}\n#services .service:nth-child(2){background-image:url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=82')}\n#services .service:nth-child(3){background-image:url('https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=82')}"
)

start = s.index("async function loadPortfolio(){")
end = s.index("function showMorePortfolio()", start)

fn = r'''async function loadPortfolio(){
  const box=document.getElementById('portfolioGallery');
  const folders=document.getElementById('portfolioFolders');
  const featured=document.getElementById('portfolioFeatured');
  const needGallery=Boolean(box&&featured&&folders);
  if(needGallery) box.innerHTML='<div class="portfolioLoading">Загружаем реальные объекты…</div>';

  async function loadFromYandex(){
    const PUBLIC_KEY='https://disk.yandex.ru/d/X4VLvyoCDpNVYA';
    const API='https://cloud-api.yandex.net/v1/disk/public/resources';
    async function walk(path,album,depth){
      if(depth>6) return [];
      const url=API+'?public_key='+encodeURIComponent(PUBLIC_KEY)+'&path='+encodeURIComponent(path||'/')+'&limit=1000&preview_size=XXXL';
      const r=await fetch(url,{cache:'no-store',referrerPolicy:'no-referrer'});
      const d=await r.json();
      if(!r.ok) throw new Error('Yandex Disk: HTTP '+r.status);
      const items=(d&&d._embedded&&d._embedded.items)||[];
      const out=[];
      for(const item of items){
        const itemPath=(path&&path!=='/'?path.replace(/\/$/,'')+'/':'/')+item.name;
        if(item.type==='dir'){
          out.push(...await walk(itemPath,item.name,depth+1));
        }else if(item.type==='file'&&/^image\//i.test(item.mime_type||'')&&(item.preview||item.file)){
          const featured=FEATURED_NAMES.includes(item.name);
          out.push({
            name:item.name,path:itemPath,
            folder:album||'Реализованные ремонты',
            album:album||'Реализованные ремонты',
            preview:item.preview||item.file,url:item.preview||item.file,
            size:Number(item.size||0),featured,
            label:featured?portfolioLabel({name:item.name}):null,
            title:featured?portfolioTitle({name:item.name}):'Реализованный ремонт',
            order:featured?FEATURED_NAMES.indexOf(item.name)+1:100
          });
        }
      }
      return out;
    }
    const images=await walk('/','Реализованные ремонты',0);
    if(!images.length) throw new Error('Яндекс Диск не вернул фотографии');
    return {ok:true,images};
  }

  try{
    let j=null;
    try{
      const a=await fetch('https://remont-pro-nine.vercel.app/api/portfolio',{cache:'force-cache'});
      const jj=await a.json();
      if(a.ok&&jj.ok&&Array.isArray(jj.images)&&jj.images.length) j=jj;
    }catch(_){}
    if(!j) j=await loadFromYandex();

    portfolioImages=j.images.filter(x=>x&&(x.preview||x.url)).map(x=>({...x,preview:x.preview||x.url,url:x.url||x.preview}));
    portfolioImages.forEach((x,i)=>x._score=portfolioScore(x)-i*0.0001);
    portfolioImages.sort(portfolioSort);

    if(!needGallery) return;

    const featuredItems=FEATURED_NAMES.map(name=>portfolioImages.find(x=>x.name===name)).filter(Boolean);
    featured.innerHTML=(featuredItems.length?featuredItems:portfolioImages.slice(0,5)).map((x,i)=>{
      const idx=portfolioImages.indexOf(x),src=x.preview||x.url;
      return '<div class="featuredPhoto" onclick="openFeatured('+idx+')"><img loading="lazy" decoding="async" src="'+src+'" alt="'+escapeHtml(portfolioLabel(x))+'"><div class="featuredInfo"><span class="featuredTag">'+escapeHtml(portfolioLabel(x))+'</span><b>'+escapeHtml(portfolioTitle(x))+'</b><span>РЕМОНТФОРМА · Казань</span></div></div>';
    }).join('');

    const names=['Все',...new Set(portfolioImages.map(x=>x.album||x.folder).filter(Boolean))];
    folders.innerHTML=names.map((x,i)=>'<button class="portfolioFolder '+(i===0?'active':'')+'" onclick="filterPortfolio('+JSON.stringify(x)+',this)">'+escapeHtml(x==='Все'?'Все объекты':x)+'</button>').join('');
    renderPortfolio('Все');
  }catch(e){
    featured.innerHTML='<div class="portfolioEmpty"><b>Не удалось загрузить фотографии.</b><br><span class="muted">'+escapeHtml(e.message||'Ошибка загрузки')+'</span><br><a class="btn" style="display:inline-block;margin-top:14px;background:#17191c;color:#fff" href="https://disk.yandex.ru/d/X4VLvyoCDpNVYA" target="_blank" rel="noopener">Открыть все работы</a></div>';
    box.innerHTML='<div class="portfolioEmpty"><b>Портфолио временно недоступно.</b><br><button class="btn" style="margin-top:14px;background:#17191c;color:#fff" onclick="loadPortfolio()">Повторить</button></div>';
  }
}
'''
s = s[:start] + fn + s[end:]
p.write_text(s, encoding="utf-8")
