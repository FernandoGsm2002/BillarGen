// Utilidades para notificaciones push

// Configuración VAPID (debes generar tus propias claves)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjVmtalDl_h9L7pTjXQZSJT9F4rLI';

// Función para convertir VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Registrar Service Worker
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration);
      return registration;
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
      return null;
    }
  }
  return null;
}

// Solicitar permiso para notificaciones
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// Suscribir a notificaciones push
export async function subscribeToPush(registration: ServiceWorkerRegistration) {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('Suscripción push:', subscription);
    
    // Aquí deberías enviar la suscripción al servidor
    await sendSubscriptionToServer(subscription);
    
    return subscription;
  } catch (error) {
    console.error('Error suscribiendo a push:', error);
    return null;
  }
}

// Enviar suscripción al servidor
async function sendSubscriptionToServer(subscription: PushSubscription) {
  try {
    // Obtener datos del usuario desde localStorage
    const userData = localStorage.getItem('user');
    if (!userData) return;

    const user = JSON.parse(userData);

    // Enviar suscripción al backend (implementar endpoint)
    const response = await fetch('/api/push-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role
      }),
    });

    if (!response.ok) {
      throw new Error('Error guardando suscripción');
    }

    console.log('Suscripción guardada en servidor');
  } catch (error) {
    console.error('Error enviando suscripción:', error);
  }
}

// Mostrar notificación local (fallback)
export function showLocalNotification(title: string, body: string, data?: any) {
  if (!('Notification' in window)) {
    alert(`${title}: ${body}`);
    return;
  }

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/pngs/logologin.png',
      data,
      tag: 'billargen-local'
    } as any);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto cerrar después de 5 segundos
    setTimeout(() => {
      notification.close();
    }, 5000);
  }
}

// Inicializar notificaciones push
export async function initializePushNotifications() {
  try {
    // Registrar service worker
    const registration = await registerServiceWorker();
    if (!registration) {
      console.warn('Service Worker no disponible');
      return false;
    }

    // Solicitar permiso
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.warn('Permisos de notificación denegados');
      return false;
    }

    // Suscribir a push
    const subscription = await subscribeToPush(registration);
    if (!subscription) {
      console.warn('No se pudo suscribir a push notifications');
      return false;
    }

    console.log('Notificaciones push inicializadas correctamente');
    return true;
  } catch (error) {
    console.error('Error inicializando notificaciones push:', error);
    return false;
  }
}
