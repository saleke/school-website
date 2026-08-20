import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name:"School Platform", short_name:"School", description:"A low-data school community and learning platform.", start_url:"/", display:"standalone", background_color:"#F6F2E9", theme_color:"#2440C4", icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]}; }
