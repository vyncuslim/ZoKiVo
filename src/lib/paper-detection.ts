import jsQR from "jsqr";

export type Choice = 0 | 1 | 2 | 3;
export type Point = { x:number; y:number };
export type Quad = [Point, Point, Point, Point];
export type CardDetection = {card:number; choice:Choice; corners:Quad};
export type NativeBarcode = {rawValue:string; format?:string; cornerPoints:Point[]};
export interface MultiQrDetector {
  detect(source:HTMLCanvasElement):Promise<NativeBarcode[]>;
}

const ANSWER_FOR_ROTATION:Choice[] = [0,3,2,1];
const PATTERN = /^ZK1:(\d{3})$/;

export function parseZoKivoCard(raw:string,corners:Quad):CardDetection|null {
  const match=PATTERN.exec(raw);
  if (!match) return null;
  const card=Number(match[1]);
  if (!Number.isInteger(card)||card<1||card>60) return null;
  const dx=corners[1].x-corners[0].x;
  const dy=corners[1].y-corners[0].y;
  if (Math.hypot(dx,dy)<14) return null;
  const quarter=((Math.round(Math.atan2(dy,dx)/(Math.PI/2))%4)+4)%4;
  return {card,choice:ANSWER_FOR_ROTATION[quarter],corners};
}

function cornersFromQR(location:NonNullable<ReturnType<typeof jsQR>>["location"],ox=0,oy=0):Quad{
  return [
    {x:location.topLeftCorner.x+ox,y:location.topLeftCorner.y+oy},
    {x:location.topRightCorner.x+ox,y:location.topRightCorner.y+oy},
    {x:location.bottomRightCorner.x+ox,y:location.bottomRightCorner.y+oy},
    {x:location.bottomLeftCorner.x+ox,y:location.bottomLeftCorner.y+oy}
  ];
}

export async function createNativeQrDetector():Promise<MultiQrDetector|null> {
  type DetectorCtor={new(opts:{formats:["qr_code"]}):MultiQrDetector;getSupportedFormats?:()=>Promise<string[]>};
  const Native=(globalThis as unknown as {BarcodeDetector?:DetectorCtor}).BarcodeDetector;
  if (!Native) return null;
  try {
    const formats=await Native.getSupportedFormats?.();
    if(formats && !formats.includes("qr_code"))return null;
    return new Native({formats:["qr_code"]});
  }catch{return null}
}

function decodeNativeRegion(ctx:CanvasRenderingContext2D,width:number,height:number,b:NativeBarcode):CardDetection|null{
  if(!b.cornerPoints||b.cornerPoints.length<4)return null;
  const xs=b.cornerPoints.map(x=>x.x),ys=b.cornerPoints.map(x=>x.y);
  const left=Math.max(0,Math.floor(Math.min(...xs))),right=Math.min(width,Math.ceil(Math.max(...xs)));
  const top=Math.max(0,Math.floor(Math.min(...ys))),bottom=Math.min(height,Math.ceil(Math.max(...ys)));
  const margin=Math.round(Math.max(right-left,bottom-top)*0.19)+7;
  const x=Math.max(0,left-margin),y=Math.max(0,top-margin);
  const endX=Math.min(width,right+margin),endY=Math.min(height,bottom+margin);
  const w=endX-x,h=endY-y;
  if(w<28||h<28)return null;
  const data=ctx.getImageData(x,y,w,h);
  // Use jsQR to recover finder-pattern orientation. Native BarcodeDetector
  // cornerPoints order is not a guarantee of physical Q-card orientation.
  const decoded=jsQR(data.data,w,h,{inversionAttempts:"dontInvert"});
  if(!decoded||decoded.data!==b.rawValue)return null;
  return parseZoKivoCard(decoded.data,cornersFromQR(decoded.location,x,y));
}

function maskedJsQrScan(ctx:CanvasRenderingContext2D,width:number,height:number,max=16):CardDetection[]{
  const original=ctx.getImageData(0,0,width,height);
  const pixels=new Uint8ClampedArray(original.data);
  const out:CardDetection[]=[];
  for(let pass=0;pass<max;pass++){
    const qr=jsQR(pixels,width,height,{inversionAttempts:"dontInvert"});
    if(!qr)break;
    const corners=cornersFromQR(qr.location);
    const parsed=parseZoKivoCard(qr.data,corners);
    if(parsed&&!out.some(x=>x.card===parsed.card))out.push(parsed);
    // Remove this detected region from a COPY of the frame. The next
    // pass can find a second or third visible QR from that same frame.
    const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
    const pad=7;
    const x0=Math.max(0,Math.floor(Math.min(...xs))-pad),x1=Math.min(width,Math.ceil(Math.max(...xs))+pad);
    const y0=Math.max(0,Math.floor(Math.min(...ys))-pad),y1=Math.min(height,Math.ceil(Math.max(...ys))+pad);
    if(x1<=x0||y1<=y0)break;
    for(let y=y0;y<y1;y++){
      const from=4*(y*width+x0),to=4*(y*width+x1);
      for(let i=from;i<to;i+=4){pixels[i]=255;pixels[i+1]=255;pixels[i+2]=255;pixels[i+3]=255}
    }
  }
  return out;
}

export async function scanCardFrame(
  canvas:HTMLCanvasElement,detector:MultiQrDetector|null,maxCards=16
):Promise<{detections:CardDetection[]; engine:"native-multi"|"jsqr-multi"; decodedBarcodes:number; unsupported:number}>{
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  if(!ctx)return {detections:[],engine:"jsqr-multi",decodedBarcodes:0,unsupported:0};
  const {width,height}=canvas;
  if(detector){
    try{
      const raw=await detector.detect(canvas);
      const hits:CardDetection[]=[];
      let unsupported=0;
      for(const code of raw.slice(0,60)){
        const result=decodeNativeRegion(ctx,width,height,code);
        if(result && !hits.some(x=>x.card===result.card))hits.push(result);
        else if(!result)unsupported++;
      }
      if(raw.length && hits.length===raw.length){
        return {detections:hits.slice(0,maxCards),engine:"native-multi",decodedBarcodes:raw.length,unsupported:0};
      }
      // Native detector either missed a QR or did not return reliable
      // finder-pattern orientation; use iterative jsQR on SAME image.
      const fallbacks=maskedJsQrScan(ctx,width,height,maxCards);
      for(const d of fallbacks)if(!hits.some(x=>x.card===d.card))hits.push(d);
      return {detections:hits.slice(0,maxCards),engine:"native-multi",decodedBarcodes:raw.length,unsupported};
    }catch{
      // Detection API is experimental; always have a portable fallback.
    }
  }
  const found=maskedJsQrScan(ctx,width,height,maxCards);
  return {detections:found,engine:"jsqr-multi",decodedBarcodes:found.length,unsupported:0};
}
