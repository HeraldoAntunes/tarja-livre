import {PDFDocument,StandardFonts,rgb,degrees,PDFName,PDFString} from 'pdf-lib';
export async function simple({label='PUBLIC CONTROL',pages=1}={}) {
 const d=await PDFDocument.create();const font=await d.embedFont(StandardFonts.Helvetica);
 for(let i=0;i<pages;i++){const p=d.addPage([240,180]);p.drawText(label,{x:20,y:125,size:12,font});}
 return d.save();
}
export async function activeContent(){
 const d=await PDFDocument.create();d.setTitle('SECRET_META_914');d.setAuthor('SECRET_AUTHOR_914');d.setSubject('SECRET_SUBJECT_914');d.setKeywords(['SECRET_KEYWORD_914']);
 const font=await d.embedFont(StandardFonts.Helvetica);const p=d.addPage([300,240]);p.drawText('PUBLIC CONTROL',{x:20,y:210,size:12,font});
 d.addJavaScript('SECRET_SCRIPT_914','app.alert("SECRET_SCRIPT_914")');
 await d.attach(new TextEncoder().encode('SECRET_ATTACHMENT_914'),'SECRET_ATTACHMENT_914.txt',{mimeType:'text/plain',description:'SECRET_ATTACHMENT_914'});
 const f=d.getForm().createTextField('SECRET_FIELD_914');f.setText('sintetico@example.test');f.addToPage(p,{x:20,y:120,width:230,height:25});
 const action=d.context.obj({S:'URI',URI:PDFString.of('https://example.test/SECRET_LINK_914')});
 const link=d.context.register(d.context.obj({Type:'Annot',Subtype:'Link',Rect:[20,40,200,65],A:action}));
 p.node.addAnnot(link);
 return d.save();
}
export async function croppedRotations(){
 const d=await PDFDocument.create();const font=await d.embedFont(StandardFonts.Helvetica);
 for(const angle of [0,90,180,270]){const p=d.addPage([360,280]);p.setCropBox(50,40,240,180);p.setRotation(degrees(angle));
 p.drawRectangle({x:0,y:0,width:360,height:280,color:rgb(1,1,1)});
 p.drawText('SYNTHETICSECRET',{x:85,y:140,size:16,font,color:rgb(1,0,0)});
 p.drawRectangle({x:70,y:70,width:15,height:15,color:rgb(0,0,1)});
 }
 return d.save();
}
