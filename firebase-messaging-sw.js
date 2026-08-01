importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBp3rh42vhASN-6eK6Tm7zmUXuEwG3pfHY",
  authDomain: "anonmessage-cfd86.firebaseapp.com",
  databaseURL: "https://anonmessage-cfd86-default-rtdb.firebaseio.com",
  projectId: "anonmessage-cfd86",
  messagingSenderId: "543836567582",
  appId: "1:543836567582:web:9df559a58cd9f385c8960f"
});

const messaging = firebase.messaging();

// Фоновые сообщения (когда сайт закрыт)
messaging.onBackgroundMessage((payload) => {
  console.log('Получено фоновое сообщение: ', payload);
  const notificationTitle = payload.notification?.title || 'Новое сообщение';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
