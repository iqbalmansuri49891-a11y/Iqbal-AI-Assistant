export default async function handler(req,res){
 if(req.method!== 'POST') return res.status(405).json({error:'Method not allowed'});
 try{
  const {message}=req.body||{};
  if(!message) return res.status(400).json({error:'Message required'});
  const key=process.env.GEMINI_API_KEY;
  if(!key) return res.status(500).json({error:'API Key missing'});
  const models=["gemini-flash-latest","gemini-2.5-flash-latest","gemini-2.0-flash"];
  let lastError="";
  for(const m of models){
   const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/${m}:generateContent?key=${key}`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({contents:[{parts:[{text:message}]}]})
   });
   const d=await r.json();
   if(r.ok && d.candidates?.[0]?.content?.parts?.[0]?.text){
    return res.status(200).json({reply:d.candidates[0].content.parts[0].text});
   }
   lastError=d?.error?.message||'failed';
  }
  return res.status(500).json({error:lastError});
 }catch(e){return res.status(500).json({error:e.message});}
}
