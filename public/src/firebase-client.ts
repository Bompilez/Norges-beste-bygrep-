import {
    getApp,
    getApps,
    initializeApp
} from 'firebase/app';

export const firebaseConfig = {
    apiKey: "AIzaSyDHrd5s3sCk45ZnIqk3DX9t30smlw7LeqQ",
    authDomain: "multiconsult-city-ranking.firebaseapp.com",
    projectId: "multiconsult-city-ranking",
    storageBucket: "multiconsult-city-ranking.firebasestorage.app",
    messagingSenderId: "333729190527",
    appId: "1:333729190527:web:56f8d1e328ccc70275e54a",
    measurementId: "G-4HPNW34DBC"
};

export function getCityRankingFirebaseApp() {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}
