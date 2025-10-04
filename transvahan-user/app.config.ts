import 'dotenv/config';
export default ({ config }: any) => ({
...config,
name: 'Transvahan User',
slug: 'transvahan-user',
extra: {
API_BASE_URL: process.env.API_BASE_URL,
WS_URL: process.env.WS_URL,
USE_MOCK: process.env.USE_MOCK === 'true',
GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
},
});