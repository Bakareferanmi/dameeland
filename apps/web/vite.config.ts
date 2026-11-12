import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {viteSingleFile} from 'vite-plugin-singlefile'

export default defineConfig(({mode})=>({
  plugins:[react(),...(mode==='offline-preview'?[viteSingleFile()]:[])],
  resolve:{alias:[{find:/^react-native$/,replacement:'react-native-web'}]},
  server:{proxy:{'/api':{target:'http://127.0.0.1:8787',ws:true}}},
}))
