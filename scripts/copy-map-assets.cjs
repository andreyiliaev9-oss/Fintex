const fs=require('node:fs'),esbuild=require('esbuild');
fs.mkdirSync('assets/maps',{recursive:true});
esbuild.buildSync({entryPoints:['ui/map-sdk.js'],bundle:true,minify:true,format:'iife',target:['es2020'],legalComments:'eof',outfile:'assets/maps/maptiler-sdk.js'});
fs.copyFileSync('node_modules/@maptiler/sdk/dist/bundler/maplibre-gl-worker.mjs','assets/maps/maplibre-gl-worker.mjs');
fs.copyFileSync('node_modules/@maptiler/sdk/dist/maptiler-sdk.css','assets/maps/maptiler-sdk.css');
for(const [pkg,name]of [['@maptiler/sdk','MAPTILER-LICENSE.txt'],['maplibre-gl','MAPLIBRE-LICENSE.txt']])fs.copyFileSync('node_modules/'+pkg+(pkg==='maplibre-gl'?'/LICENSE.txt':'/LICENSE'),'assets/maps/'+name);
