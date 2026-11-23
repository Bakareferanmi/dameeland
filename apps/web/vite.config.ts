import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {viteSingleFile} from 'vite-plugin-singlefile'

export default defineConfig(({mode})=>({
  plugins:[react(),...(mode==='offline-preview'?[viteSingleFile()]:[])],
  resolve:{alias:[{find:/^react-native$/,replacement:'react-native-web'}]},
  build:{
    rollupOptions:{output:{manualChunks(id){
      // Libraries change far less often than the app, so splitting them lets returning visitors reuse them from cache after a deploy.
      if(!id.includes('node_modules'))return
      if(/node_modules\/(react|react-dom|scheduler)\//.test(id))return 'vendor-react'
      if(/node_modules\/(react-native-web|@react-native|styleq|inline-style-prefixer|css-in-js-utils|fbjs|nullthrows|memoize-one|normalize-css-color)\//.test(id))return 'vendor-native-web'
      return 'vendor'
    }}},
  },
  server:{proxy:{'/api':{target:'http://127.0.0.1:8787',ws:true}}},
}))
