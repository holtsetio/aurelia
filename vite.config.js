import { defineConfig } from 'vite'
import tslOperatorPlugin from 'vite-plugin-tsl-operator'

export default defineConfig({
    server: {
        port: 1234,
    },
    plugins: [
        tslOperatorPlugin({logs:false})
        //.. other plugins
    ]
});