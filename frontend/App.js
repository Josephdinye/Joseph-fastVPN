import React, { useState, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Server, Info, Settings } from 'lucide-react-native';

import HomeScreen from './screens/HomeScreen';
import ServersScreen from './screens/ServersScreen';
import AboutScreen from './screens/AboutScreen';
import SettingsScreen from './screens/SettingsScreen';

import { requestAllAppPermissions } from './permissions';

const Tab = createBottomTabNavigator();

// 🌍 THE GLOBAL APPLICATION TRANSLATION DICTIONARY MATRIX
export const translations = {
  EN: {
    tabHome: "Home", tabServers: "Servers", tabAbout: "About", tabSettings: "Settings",
    protected: "Protected", connecting: "Connecting...", unprotected: "Unprotected",
    manualSel: "Manual Selection", smartLoad: "Smart Load Balancing", change: "Change",
    up: "UP", down: "DOWN", duration: "DURATION", totalUp: "TOTAL UP", totalDown: "TOTAL DOWN",
    vpnLocs: "VPN Locations", proxySub: "Select an ultra-fast proxy node channel", autoSel: "Automatic Select",
    autoDesc: "Always use the lowest latency configuration", fastest: "Fastest", available: "servers available",
    aboutTitle: "About App", aboutSub: "System information & developer credits", appName: "App Name",
    devInfo: "Developer Info", webPortfolio: "Official Website Portfolio", buildVer: "Core Build Version",
    engineProt: "Routing Engine Protocol", settingsTitle: "Settings", sub: "SUBSCRIPTION",
    subBtn: "Subscriptions", subDesc: "Add your sources, turn on/off", conn: "CONNECTION",
    autoBoot: "Auto-Connect on Boot", autoBootDesc: "Reconnect VPN automatically when device starts",
    hotspot: "Hotspot Sharing", hotspotDesc: "Share VPN via hotspot - enable, then set proxy on the other device",
    split: "SPLIT TUNNELING", splitBtn: "Enable Split Tunneling", splitDesc: "Choose which apps bypass the VPN",
    dns: "DNS", primaryDns: "Primary DNS", secondaryDns: "Secondary DNS", langLabel: "App Language"
  },
  RU: {
    tabHome: "Главная", tabServers: "Серверы", tabAbout: "Инфо", tabSettings: "Настройки",
    protected: "Защищено", connecting: "Подключение...", unprotected: "Не защищено",
    manualSel: "Ручной выбор", smartLoad: "Умная балансировка", change: "Изменить",
    up: "ОТПРАВЛЕНО", down: "ПРИНЯТО", duration: "ВРЕМЯ", totalUp: "ВСЕГО ОТП.", totalDown: "ВСЕГО ПРИН.",
    vpnLocs: "VPN Локации", proxySub: "Выберите сверхбыстрый прокси-канал", autoSel: "Автоматический выбор",
    autoDesc: "Всегда использовать конфигурацию с минимальной задержкой", fastest: "Быстрый", available: "серверов доступно",
    aboutTitle: "О приложении", aboutSub: "Системная информация и данные разработчика", appName: "Имя приложения",
    devInfo: "Разработчик", webPortfolio: "Официальный сайт портфолио", buildVer: "Версия сборки",
    engineProt: "Протокол маршрутизации", settingsTitle: "Настройки", sub: "ПОДПИСКА",
    subBtn: "Подписки / Subscriptions", subDesc: "Добавить свои источники, включить/выключить", conn: "ПОДКЛЮЧЕНИЕ",
    autoBoot: "Авто-подключение при загрузке", autoBootDesc: "Автоматически переподключать VPN при запуске устройства",
    hotspot: "Раздача хотспота", hotspotDesc: "Раздавать VPN через хотспот – включите, затем настройте прокси на другом устройстве",
    split: "РАЗДЕЛЬНОЕ ТУННЕЛИРОВАНИЕ", splitBtn: "Включить Split Tunneling", splitDesc: "Выберите приложения, которые обходят VPN",
    dns: "DNS", primaryDns: "Первичный DNS", secondaryDns: "Вторичный DNS", langLabel: "Язык приложения"
  },
  ES: {
    tabHome: "Inicio", tabServers: "Servidores", tabAbout: "Info", tabSettings: "Ajustes",
    protected: "Protegido", connecting: "Conectando...", unprotected: "Inseguro",
    manualSel: "Selección Manual", smartLoad: "Equilibrio de Carga Inteligente", change: "Cambiar",
    up: "SUBIDA", down: "BAJADA", duration: "DURATION", totalUp: "SUBIDA TOTAL", totalDown: "BAJADA TOTAL",
    vpnLocs: "Ubicaciones VPN", proxySub: "Seleccione un canal de nodo proxy ultrarrápido", autoSel: "Selección Automática",
    autoDesc: "Utilice siempre la configuración de latencia más baja", fastest: "Más rápido", available: "servidores disponibles",
    aboutTitle: "Acerca de", aboutSub: "Información del sistema y créditos del desarrollador", appName: "Nombre de la aplicación",
    devInfo: "Información del desarrollador", webPortfolio: "Sitio Web Oficial de Portafolio", buildVer: "Versión de compilación",
    engineProt: "Protocolo del motor de enrutamiento", settingsTitle: "Ajustes", sub: "SUSCRIPCIÓN",
    subBtn: "Suscripciones", subDesc: "Agregue sus fuentes, encienda/apague", conn: "CONEXIÓN",
    autoBoot: "Auto-conectar al iniciar", autoBootDesc: "Vuelva a conectar VPN automáticamente cuando se inicie el dispositivo",
    hotspot: "Compartir Hotspot", hotspotDesc: "Compartir VPN a través de hotspot: habilite, luego configure el proxy en el otro dispositivo",
    split: "TÚNEL DIVIDIDO", splitBtn: "Habilitar Túnel Dividido", splitDesc: "Elija qué aplicaciones eluden la VPN",
    dns: "DNS", primaryDns: "DNS Primario", secondaryDns: "DNS Secundario", langLabel: "Idioma de la aplicación"
  },
  FR: {
    tabHome: "Accueil", tabServers: "Serveurs", tabAbout: "Infos", tabSettings: "Paramètres",
    protected: "Protégé", connecting: "Connexion...", unprotected: "Non protégé",
    manualSel: "Sélection Manuelle", smartLoad: "Équilibrage de Charge Intelligent", change: "Modifier",
    up: "ENVOI", down: "REÇU", duration: "DURÉE", totalUp: "TOTAL ENVOYÉ", totalDown: "TOTAL REÇU",
    vpnLocs: "Emplacements VPN", proxySub: "Sélectionnez un canal de nœud proxy ultra-rapide", autoSel: "Sélection Automatique",
    autoDesc: "Toujours utiliser la configuration de latence la plus basse", fastest: "Plus rapide", available: "serveurs disponibles",
    aboutTitle: "À propos", aboutSub: "Informations système et crédits du développeur", appName: "Nom de l'application",
    devInfo: "Développeur", webPortfolio: "Site Web Officiel du Portfolio", buildVer: "Version de la version",
    engineProt: "Protocole du moteur de routage", settingsTitle: "Paramètres", sub: "ABONNEMENT",
    subBtn: "Abonnements", subDesc: "Ajoutez vos sources, activez/désactivez", conn: "CONNEXION",
    autoBoot: "Connexion Auto au Démarrage", autoBootDesc: "Reconnecter le VPN automatiquement au démarrage de l'appareil",
    hotspot: "Partage de Connexion", hotspotDesc: "Partager le VPN via un point d'accès - activez, puis configurez le proxy sur l'autre appareil",
    split: "TUNNELING DIVISÉ", splitBtn: "Activer le Tunneling Divisé", splitDesc: "Choisissez les applications qui contournent le VPN",
    dns: "DNS", primaryDns: "DNS Primaire", secondaryDns: "DNS Secondaire", langLabel: "Langue de l'application"
  },
  ZH: {
    tabHome: "首页", tabServers: "服务器", tabAbout: "关于", tabSettings: "设置",
    protected: "已保护", connecting: "连接中...", unprotected: "未保护",
    manualSel: "手动选择", smartLoad: "智能负载均衡", change: "更改",
    up: "上传", down: "下载", duration: "时长", totalUp: "总上传", totalDown: "总下载",
    vpnLocs: "VPN 位置", proxySub: "选择超高速代理节点通道", autoSel: "自动选择",
    autoDesc: "始终使用延迟最低的配置", fastest: "最快", available: "个可用服务器",
    aboutTitle: "关于应用", aboutSub: "系统信息与开发者信息", appName: "应用名称",
    devInfo: "开发者信息", webPortfolio: "官方作品集网站", buildVer: "核心构建版本",
    engineProt: "路由引擎协议", settingsTitle: "设置", sub: "订阅",
    subBtn: "订阅", subDesc: "添加您的来源，开启/关闭", conn: "连接",
    autoBoot: "开机自动连接", autoBootDesc: "设备启动时自动重新连接 VPN",
    hotspot: "热点共享", hotspotDesc: "通过热点共享 VPN — 启用后在其他设备上设置代理",
    split: "分流隧道", splitBtn: "启用分流隧道", splitDesc: "选择哪些应用绕过 VPN",
    dns: "DNS", primaryDns: "主 DNS", secondaryDns: "备用 DNS", langLabel: "应用语言"
  },
  AR: {
    tabHome: "الرئيسية", tabServers: "الخوادم", tabAbout: "حول", tabSettings: "الإعدادات",
    protected: "محمي", connecting: "جارٍ الاتصال...", unprotected: "غير محمي",
    manualSel: "اختيار يدوي", smartLoad: "موازنة التحميل الذكية", change: "تغيير",
    up: "رفع", down: "تنزيل", duration: "المدة", totalUp: "إجمالي الرفع", totalDown: "إجمالي التنزيل",
    vpnLocs: "مواقع VPN", proxySub: "اختر قناة عقدة بروكسي فائقة السرعة", autoSel: "اختيار تلقائي",
    autoDesc: "استخدم دائمًا الإعداد ذو أقل زمن استجابة", fastest: "الأسرع", available: "خوادم متاحة",
    aboutTitle: "حول التطبيق", aboutSub: "معلومات النظام وبيانات المطور", appName: "اسم التطبيق",
    devInfo: "معلومات المطور", webPortfolio: "الموقع الرسمي للأعمال", buildVer: "إصدار البناء الأساسي",
    engineProt: "بروتوكول محرك التوجيه", settingsTitle: "الإعدادات", sub: "الاشتراك",
    subBtn: "الاشتراكات", subDesc: "أضف مصادرك، شغّل/أوقف", conn: "الاتصال",
    autoBoot: "اتصال تلقائي عند التشغيل", autoBootDesc: "أعد الاتصال بـ VPN تلقائيًا عند بدء الجهاز",
    hotspot: "مشاركة نقطة الاتصال", hotspotDesc: "شارك VPN عبر نقطة الاتصال — فعّل ثم اضبط البروكسي على الجهاز الآخر",
    split: "النفق المقسم", splitBtn: "تفعيل النفق المقسم", splitDesc: "اختر التطبيقات التي تتجاوز VPN",
    dns: "DNS", primaryDns: "DNS الأساسي", secondaryDns: "DNS الثانوي", langLabel: "لغة التطبيق"
  }
};
export default function App() {
  // 🔑 THE KING GLOBAL STATE: Shares language choice with all nested screen bundles
  const [appLang, setAppLang] = useState('EN'); 

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#00E5FF',
          tabBarInactiveTintColor: '#555559',
          tabBarStyle: {
            backgroundColor: '#0C1322',
            borderTopWidth: 1,
            borderColor: '#1E293B',
            paddingBottom: 8,
            paddingTop: 8,
            height: 60
          },
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Home') return <Home size={size} color={color} />;
            if (route.name === 'Servers') return <Server size={size} color={color} />;
            if (route.name === 'About') return <Info size={size} color={color} />;
            if (route.name === 'Settings') return <Settings size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" options={{ tabBarLabel: translations[appLang].tabHome }}>
          {(props) => <HomeScreen {...props} appLang={appLang} />}
        </Tab.Screen>
        <Tab.Screen name="Servers" options={{ tabBarLabel: translations[appLang].tabServers }}>
          {(props) => <ServersScreen {...props} appLang={appLang} />}
        </Tab.Screen>
        <Tab.Screen name="About" options={{ tabBarLabel: translations[appLang].tabAbout }}>
          {(props) => <AboutScreen {...props} appLang={appLang} />}
        </Tab.Screen>
        <Tab.Screen name="Settings" options={{ tabBarLabel: translations[appLang].tabSettings }}>
          {(props) => <SettingsScreen {...props} appLang={appLang} setAppLang={setAppLang} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
