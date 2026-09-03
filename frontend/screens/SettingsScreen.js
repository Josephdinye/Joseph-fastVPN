import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CloudLightning,
  Wifi,
  GitFork,
  Server,
  ChevronRight,
  Languages,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  X,
  Globe,
  Smartphone,
} from 'lucide-react-native';

import { translations } from '../App';


/* ============================================================
   STORAGE
============================================================ */

const STORAGE_KEYS = {
  AUTO_CONNECT: '@settings_auto_connect',
  HOTSPOT: '@settings_hotspot',

  SPLIT_TUNNEL: '@settings_split_tunnel',
  SPLIT_TUNNEL_MODE: '@settings_split_tunnel_mode',
  SPLIT_TUNNEL_APPS: '@settings_split_tunnel_apps',
  SPLIT_TUNNEL_DOMAINS: '@settings_split_tunnel_domains',

  PRIMARY_DNS: '@settings_primary_dns',
  SECONDARY_DNS: '@settings_secondary_dns',
};


/* ============================================================
   DNS OPTIONS
============================================================ */

const DNS_OPTIONS = [
  {
    id: 'cloudflare',
    label: '1.1.1.1 (Cloudflare)',
    value: '1.1.1.1',
  },
  {
    id: 'google',
    label: '8.8.8.8 (Google)',
    value: '8.8.8.8',
  },
  {
    id: 'quad9',
    label: '9.9.9.9 (Quad9)',
    value: '9.9.9.9',
  },
  {
    id: 'opendns',
    label: '208.67.222.222 (OpenDNS)',
    value: '208.67.222.222',
  },
];


/* ============================================================
   SPLIT TUNNEL MODES
============================================================ */

const SPLIT_MODES = {
  BYPASS: 'bypass',
  VPN_ONLY: 'vpn_only',
};


/* ============================================================
   COMMON APPLICATION EXAMPLES
   These are package names, NOT website names.
============================================================ */

const COMMON_APPS = [
  {
    name: 'Chrome',
    packageName: 'com.android.chrome',
  },
  {
    name: 'YouTube',
    packageName: 'com.google.android.youtube',
  },
  {
    name: 'WhatsApp',
    packageName: 'com.whatsapp',
  },
  {
    name: 'Telegram',
    packageName: 'org.telegram.messenger',
  },
  {
    name: 'Instagram',
    packageName: 'com.instagram.android',
  },
  {
    name: 'Facebook',
    packageName: 'com.facebook.katana',
  },
];


/* ============================================================
   SETTINGS SCREEN
============================================================ */

export default function SettingsScreen({ appLang, setAppLang }) {
  const t = translations[appLang || 'EN'];

  /* ----------------------------------------------------------
     GENERAL SETTINGS
  ---------------------------------------------------------- */

  const [loading, setLoading] = useState(true);

  const [autoConnect, setAutoConnect] = useState(false);

  const [hotspotSharing, setHotspotSharing] = useState(false);

  const [splitTunneling, setSplitTunneling] = useState(false);

  const [primaryDns, setPrimaryDns] = useState('1.1.1.1');

  const [secondaryDns, setSecondaryDns] = useState('8.8.8.8');


  /* ----------------------------------------------------------
     DROPDOWNS
  ---------------------------------------------------------- */

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isDnsOpen, setIsDnsOpen] = useState(false);

  const [isSplitOpen, setIsSplitOpen] = useState(false);

  const [isModeOpen, setIsModeOpen] = useState(false);


  /* ----------------------------------------------------------
     SPLIT TUNNEL STATE
  ---------------------------------------------------------- */

  const [splitMode, setSplitMode] = useState(
    SPLIT_MODES.BYPASS
  );

  const [splitApps, setSplitApps] = useState([]);

  const [splitDomains, setSplitDomains] = useState([]);


  /* ----------------------------------------------------------
     INPUTS
  ---------------------------------------------------------- */

  const [appInput, setAppInput] = useState('');

  const [domainInput, setDomainInput] = useState('');


  /* ----------------------------------------------------------
     LANGUAGES
  ---------------------------------------------------------- */

  const languagesList = [
    {
      code: 'EN',
      label: 'English (US) 🇺🇸',
    },
    {
      code: 'RU',
      label: 'Русский (RU) 🇷🇺',
    },
    {
      code: 'ES',
      label: 'Español (ES) 🇪🇸',
    },
    {
      code: 'FR',
      label: 'Français (FR) 🇫🇷',
    },
    {
      code: 'ZH',
      label: '中文 (CN) 🇨🇳',
    },
    {
      code: 'AR',
      label: 'العربية (AR) 🇸🇦',
    },
  ];


  /* ============================================================
     LOAD SETTINGS
  ============================================================ */

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [
          auto,
          hotspot,
          split,
          mode,
          apps,
          domains,
          pDns,
          sDns,
        ] = await Promise.all([
          AsyncStorage.getItem(
            STORAGE_KEYS.AUTO_CONNECT
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.HOTSPOT
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.SPLIT_TUNNEL
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.SPLIT_TUNNEL_MODE
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.SPLIT_TUNNEL_APPS
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.PRIMARY_DNS
          ),

          AsyncStorage.getItem(
            STORAGE_KEYS.SECONDARY_DNS
          ),
        ]);


        /* GENERAL */

        if (auto !== null) {
          setAutoConnect(auto === 'true');
        }

        if (hotspot !== null) {
          setHotspotSharing(hotspot === 'true');
        }


        /* SPLIT TUNNEL */

        if (split !== null) {
          setSplitTunneling(split === 'true');
        }

        if (
          mode === SPLIT_MODES.BYPASS ||
          mode === SPLIT_MODES.VPN_ONLY
        ) {
          setSplitMode(mode);
        }

        if (apps) {
          try {
            const parsedApps = JSON.parse(apps);

            if (Array.isArray(parsedApps)) {
              setSplitApps(parsedApps);
            }
          } catch (error) {
            console.warn(
              'Could not parse split tunnel apps',
              error
            );
          }
        }

        if (domains) {
          try {
            const parsedDomains = JSON.parse(domains);

            if (Array.isArray(parsedDomains)) {
              setSplitDomains(parsedDomains);
            }
          } catch (error) {
            console.warn(
              'Could not parse split tunnel domains',
              error
            );
          }
        }


        /* DNS */

        if (pDns) {
          setPrimaryDns(pDns);
        }

        if (sDns) {
          setSecondaryDns(sDns);
        }

      } catch (error) {
        console.warn(
          'Failed to load settings',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);


  /* ============================================================
     SAVE HELPERS
  ============================================================ */

  const saveBool = async (
    key,
    value,
    setter
  ) => {
    setter(value);

    try {
      await AsyncStorage.setItem(
        key,
        value ? 'true' : 'false'
      );
    } catch (error) {
      console.warn(
        'Failed to save setting',
        error
      );
    }
  };


  const saveString = async (
    key,
    value,
    setter
  ) => {
    setter(value);

    try {
      await AsyncStorage.setItem(
        key,
        value
      );
    } catch (error) {
      console.warn(
        'Failed to save setting',
        error
      );
    }
  };


  /* ============================================================
     SAVE SPLIT TUNNEL CONFIGURATION
  ============================================================ */

  const saveSplitApps = async (apps) => {
    setSplitApps(apps);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SPLIT_TUNNEL_APPS,
        JSON.stringify(apps)
      );
    } catch (error) {
      console.warn(
        'Failed to save split tunnel apps',
        error
      );
    }
  };


  const saveSplitDomains = async (domains) => {
    setSplitDomains(domains);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SPLIT_TUNNEL_DOMAINS,
        JSON.stringify(domains)
      );
    } catch (error) {
      console.warn(
        'Failed to save split tunnel domains',
        error
      );
    }
  };


  const saveSplitMode = async (mode) => {
    setSplitMode(mode);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SPLIT_TUNNEL_MODE,
        mode
      );
    } catch (error) {
      console.warn(
        'Failed to save split tunnel mode',
        error
      );
    }
  };


  /* ============================================================
     AUTO CONNECT
  ============================================================ */

  const onAutoConnectChange = (value) => {
    saveBool(
      STORAGE_KEYS.AUTO_CONNECT,
      value,
      setAutoConnect
    );

    if (value) {
      Alert.alert(
        t.autoBoot || 'Auto Connect',
        'VPN will try to connect automatically when the app starts.'
      );
    }
  };


  /* ============================================================
     HOTSPOT
  ============================================================ */

  const onHotspotChange = (value) => {
    saveBool(
      STORAGE_KEYS.HOTSPOT,
      value,
      setHotspotSharing
    );

    if (value) {
      Alert.alert(
        t.hotspot || 'Hotspot Sharing',
        'Hotspot VPN sharing requires native Android VPN support.'
      );
    }
  };


  /* ============================================================
     SPLIT TUNNEL MASTER SWITCH
  ============================================================ */

  const onSplitTunnelChange = async (value) => {
    setSplitTunneling(value);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.SPLIT_TUNNEL,
        value ? 'true' : 'false'
      );
    } catch (error) {
      console.warn(
        'Failed to save split tunnel setting',
        error
      );
    }

    if (value) {
      setIsSplitOpen(true);
    }
  };


  /* ============================================================
     ADD APPLICATION
  ============================================================ */

  const addApplication = async () => {
    const value = appInput.trim();

    if (!value) {
      return;
    }

    /* Prevent duplicate packages */

    if (splitApps.includes(value)) {
      Alert.alert(
        'Already Added',
        'This application is already in your split-tunneling list.'
      );

      return;
    }

    /* Basic Android package-name validation */

    const packagePattern =
      /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

    if (!packagePattern.test(value)) {
      Alert.alert(
        'Invalid Package Name',
        'Enter an Android package name such as com.whatsapp or com.google.android.youtube.'
      );

      return;
    }

    const newApps = [
      ...splitApps,
      value,
    ];

    await saveSplitApps(newApps);

    setAppInput('');
  };


  /* ============================================================
     ADD COMMON APPLICATION
  ============================================================ */

  const addCommonApplication = async (
    packageName
  ) => {
    if (splitApps.includes(packageName)) {
      return;
    }

    const newApps = [
      ...splitApps,
      packageName,
    ];

    await saveSplitApps(newApps);
  };


  /* ============================================================
     REMOVE APPLICATION
  ============================================================ */

  const removeApplication = async (
    packageName
  ) => {
    const newApps =
      splitApps.filter(
        (item) => item !== packageName
      );

    await saveSplitApps(newApps);
  };


  /* ============================================================
     ADD WEBSITE / DOMAIN
  ============================================================ */

  const addDomain = async () => {
    let value = domainInput
      .trim()
      .toLowerCase();

    if (!value) {
      return;
    }


    /* Remove protocol */

    value = value
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '');


    /* Remove path */

    value = value.split('/')[0];


    /* Remove trailing dot */

    value = value.replace(/\.$/, '');


    /* Basic domain validation */

    const domainPattern =
      /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domainPattern.test(value)) {
      Alert.alert(
        'Invalid Domain',
        'Enter a domain such as youtube.com or google.com.'
      );

      return;
    }


    if (splitDomains.includes(value)) {
      Alert.alert(
        'Already Added',
        'This domain is already in your split-tunneling list.'
      );

      return;
    }


    const newDomains = [
      ...splitDomains,
      value,
    ];

    await saveSplitDomains(newDomains);

    setDomainInput('');
  };


  /* ============================================================
     REMOVE DOMAIN
  ============================================================ */

  const removeDomain = async (
    domain
  ) => {
    const newDomains =
      splitDomains.filter(
        (item) => item !== domain
      );

    await saveSplitDomains(newDomains);
  };


  /* ============================================================
     LANGUAGE
  ============================================================ */

  const getFullLanguageLabel = () => {
    const matched =
      languagesList.find(
        (item) => item.code === appLang
      );

    return matched
      ? matched.label
      : 'English (US) 🇺🇸';
  };


  const handleSelectLanguage = (
    code
  ) => {
    setAppLang(code);
    setIsDropdownOpen(false);
  };


  /* ============================================================
     DNS
  ============================================================ */

  const onSelectPrimaryDns = (
    value
  ) => {
    saveString(
      STORAGE_KEYS.PRIMARY_DNS,
      value,
      setPrimaryDns
    );

    setIsDnsOpen(false);
  };


  /* ============================================================
     SPLIT MODE LABEL
  ============================================================ */

  const getSplitModeLabel = () => {
    if (
      splitMode === SPLIT_MODES.VPN_ONLY
    ) {
      return 'VPN only for selected apps';
    }

    return 'Bypass selected apps';
  };


  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.tabCanvas,
          styles.center,
        ]}
      >
        <ActivityIndicator
          size="large"
          color="#00E5FF"
        />
      </SafeAreaView>
    );
  }


  /* ============================================================
     UI
  ============================================================ */

  return (
    <SafeAreaView
      style={styles.tabCanvas}
    >
      <ScrollView
        style={styles.scrollWrapper}
        showsVerticalScrollIndicator={false}
      >

        {/* =====================================================
            HEADER
        ====================================================== */}

        <View
          style={styles.pageHeaderWrapper}
        >
          <Text style={styles.pageTitle}>
            {t.settingsTitle}
          </Text>
        </View>


        {/* =====================================================
            LANGUAGE
        ====================================================== */}

        <View style={styles.sectionBlock}>

          <Text style={styles.sectionHeader}>
            {t.langLabel?.toUpperCase() ||
              'LANGUAGE'}
          </Text>


          <TouchableOpacity
            style={[
              styles.languageCardRow,
              isDropdownOpen &&
                styles.dropdownCardRowActive,
            ]}
            onPress={() =>
              setIsDropdownOpen(
                !isDropdownOpen
              )
            }
          >

            <View
              style={styles.rowLeftBlock}
            >
              <Languages
                size={20}
                color="#00E5FF"
              />

              <Text
                style={styles.mainItemText}
              >
                {getFullLanguageLabel()}
              </Text>
            </View>


            {isDropdownOpen ? (
              <ChevronUp
                size={20}
                color="#00E5FF"
              />
            ) : (
              <ChevronDown
                size={20}
                color="#4A5A70"
              />
            )}

          </TouchableOpacity>


          {isDropdownOpen && (
            <View
              style={
                styles.dropdownOpenContainer
              }
            >

              {languagesList.map(
                (item, index) => {

                  const isSelected =
                    item.code === appLang;

                  return (
                    <View
                      key={item.code}
                    >

                      <TouchableOpacity
                        style={[
                          styles.dropdownItemRow,
                          isSelected &&
                            styles.dropdownItemRowSelected,
                        ]}
                        onPress={() =>
                          handleSelectLanguage(
                            item.code
                          )
                        }
                      >

                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected &&
                              styles.dropdownItemTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>


                        {isSelected && (
                          <Check
                            size={16}
                            color="#00E5FF"
                          />
                        )}

                      </TouchableOpacity>


                      {index <
                        languagesList.length -
                          1 && (
                        <View
                          style={
                            styles.innerDividerLine
                          }
                        />
                      )}

                    </View>
                  );
                }
              )}

            </View>
          )}

        </View>


        {/* =====================================================
            SUBSCRIPTION
        ====================================================== */}

        <View style={styles.sectionBlock}>

          <Text style={styles.sectionHeader}>
            {t.sub?.toUpperCase() ||
              'SUBSCRIPTION'}
          </Text>


          <TouchableOpacity
            style={styles.menuCardRow}
            onPress={() =>
              Alert.alert(
                t.subBtn ||
                  'Update Subscription',
                t.subDesc ||
                  'Server list will be refreshed from the source.'
              )
            }
          >

            <View
              style={styles.rowLeftBlock}
            >

              <View
                style={styles.cloudIconBadge}
              >
                <Server
                  size={18}
                  color="#FFF"
                />
              </View>


              <View
                style={styles.textColumn}
              >

                <Text
                  style={styles.mainItemText}
                >
                  {t.subBtn ||
                    'Update Subscription'}
                </Text>

                <Text
                  style={
                    styles.subItemDescText
                  }
                >
                  {t.subDesc ||
                    'Refresh server list'}
                </Text>

              </View>

            </View>


            <ChevronRight
              size={20}
              color="#3A4D62"
            />

          </TouchableOpacity>

        </View>


        {/* =====================================================
            CONNECTION
        ====================================================== */}

        <View style={styles.sectionBlock}>

          <Text style={styles.sectionHeader}>
            {t.conn || 'CONNECTION'}
          </Text>


          <View
            style={
              styles.groupCardContainer
            }
          >

            {/* AUTO CONNECT */}

            <View
              style={styles.switchCardRow}
            >

              <View
                style={styles.rowLeftBlock}
              >

                <CloudLightning
                  size={20}
                  color="#00E5FF"
                />

                <View
                  style={styles.textColumn}
                >

                  <Text
                    style={
                      styles.mainItemText
                    }
                  >
                    {t.autoBoot ||
                      'Auto Connect'}
                  </Text>

                  <Text
                    style={
                      styles.subItemDescText
                    }
                  >
                    {t.autoBootDesc ||
                      'Connect automatically on app start'}
                  </Text>

                </View>

              </View>


              <Switch
                trackColor={{
                  false: '#16233B',
                  true: '#00E5FF',
                }}
                thumbColor={
                  autoConnect
                    ? '#FFFFFF'
                    : '#4A5A70'
                }
                value={autoConnect}
                onValueChange={
                  onAutoConnectChange
                }
              />

            </View>


            <View
              style={
                styles.innerDividerLine
              }
            />


            {/* HOTSPOT */}

            <View
              style={styles.switchCardRow}
            >

              <View
                style={styles.rowLeftBlock}
              >

                <Wifi
                  size={20}
                  color="#00E5FF"
                />

                <View
                  style={styles.textColumn}
                >

                  <Text
                    style={
                      styles.mainItemText
                    }
                  >
                    {t.hotspot ||
                      'Hotspot Sharing'}
                  </Text>

                  <Text
                    style={
                      styles.subItemDescText
                    }
                  >
                    {t.hotspotDesc ||
                      'Share VPN with hotspot clients'}
                  </Text>

                </View>

              </View>


              <Switch
                trackColor={{
                  false: '#16233B',
                  true: '#00E5FF',
                }}
                thumbColor={
                  hotspotSharing
                    ? '#FFFFFF'
                    : '#4A5A70'
                }
                value={hotspotSharing}
                onValueChange={
                  onHotspotChange
                }
              />

            </View>

          </View>

        </View>


        {/* =====================================================
            SPLIT TUNNELING
        ====================================================== */}

        <View style={styles.sectionBlock}>

          <Text style={styles.sectionHeader}>
            {t.split ||
              'SPLIT TUNNELING'}
          </Text>


          {/* MASTER SWITCH */}

          <View
            style={styles.switchCardRowSingle}
          >

            <View
              style={styles.rowLeftBlock}
            >

              <GitFork
                size={20}
                color="#00E5FF"
                style={
                  styles.rotatedIcon
                }
              />

              <View
                style={styles.textColumn}
              >

                <Text
                  style={
                    styles.mainItemText
                  }
                >
                  {t.splitBtn ||
                    'Split Tunneling'}
                </Text>

                <Text
                  style={
                    styles.subItemDescText
                  }
                >
                  {splitTunneling
                    ? `${splitApps.length} apps • ${splitDomains.length} domains configured`
                    : 'Choose which apps and websites bypass VPN'}
                </Text>

              </View>

            </View>


            <Switch
              trackColor={{
                false: '#16233B',
                true: '#00E5FF',
              }}
              thumbColor={
                splitTunneling
                  ? '#FFFFFF'
                  : '#4A5A70'
              }
              value={splitTunneling}
              onValueChange={
                onSplitTunnelChange
              }
            />

          </View>


          {/* CONFIGURATION */}

          {splitTunneling && (
            <View
              style={
                styles.splitConfiguration
              }
            >

              {/* MODE */}

              <TouchableOpacity
                style={[
                  styles.languageCardRow,
                  isModeOpen &&
                    styles.dropdownCardRowActive,
                ]}
                onPress={() =>
                  setIsModeOpen(
                    !isModeOpen
                  )
                }
              >

                <View
                  style={
                    styles.rowLeftBlock
                  }
                >

                  <GitFork
                    size={19}
                    color="#00E5FF"
                  />

                  <View
                    style={
                      styles.textColumn
                    }
                  >

                    <Text
                      style={
                        styles.mainItemText
                      }
                    >
                      Routing Mode
                    </Text>

                    <Text
                      style={
                        styles.subItemDescText
                      }
                    >
                      {getSplitModeLabel()}
                    </Text>

                  </View>

                </View>


                {isModeOpen ? (
                  <ChevronUp
                    size={20}
                    color="#00E5FF"
                  />
                ) : (
                  <ChevronDown
                    size={20}
                    color="#4A5A70"
                  />
                )}

              </TouchableOpacity>


              {isModeOpen && (
                <View
                  style={
                    styles.dropdownOpenContainer
                  }
                >

                  {/* BYPASS */}

                  <TouchableOpacity
                    style={
                      styles.modeOption
                    }
                    onPress={() => {
                      saveSplitMode(
                        SPLIT_MODES.BYPASS
                      );

                      setIsModeOpen(false);
                    }}
                  >

                    <View
                      style={
                        styles.modeTextContainer
                      }
                    >

                      <Text
                        style={
                          styles.modeTitle
                        }
                      >
                        Bypass selected apps
                      </Text>

                      <Text
                        style={
                          styles.modeDescription
                        }
                      >
                        Selected apps and domains
                        do NOT use the VPN.
                      </Text>

                    </View>


                    {splitMode ===
                      SPLIT_MODES.BYPASS && (
                      <Check
                        size={18}
                        color="#00E5FF"
                      />
                    )}

                  </TouchableOpacity>


                  <View
                    style={
                      styles.innerDividerLine
                    }
                  />


                  {/* VPN ONLY */}

                  <TouchableOpacity
                    style={
                      styles.modeOption
                    }
                    onPress={() => {
                      saveSplitMode(
                        SPLIT_MODES.VPN_ONLY
                      );

                      setIsModeOpen(false);
                    }}
                  >

                    <View
                      style={
                        styles.modeTextContainer
                      }
                    >

                      <Text
                        style={
                          styles.modeTitle
                        }
                      >
                        VPN only for selected
                      </Text>

                      <Text
                        style={
                          styles.modeDescription
                        }
                      >
                        Only selected apps use
                        the VPN.
                      </Text>

                    </View>


                    {splitMode ===
                      SPLIT_MODES.VPN_ONLY && (
                      <Check
                        size={18}
                        color="#00E5FF"
                      />
                    )}

                  </TouchableOpacity>

                </View>
              )}


              {/* =================================================
                  APPLICATIONS
              ================================================== */}

              <View
                style={
                  styles.splitSubSection
                }
              >

                <View
                  style={
                    styles.splitSectionTitle
                  }
                >

                  <Smartphone
                    size={18}
                    color="#00E5FF"
                  />

                  <Text
                    style={
                      styles.splitSectionTitleText
                    }
                  >
                    Applications
                  </Text>

                </View>


                <Text
                  style={
                    styles.splitHelpText
                  }
                >
                  Add Android package names for
                  applications that should follow
                  your selected routing rule.
                </Text>


                {/* COMMON APPS */}

                <View
                  style={
                    styles.commonAppsContainer
                  }
                >

                  {COMMON_APPS.map(
                    (app) => {

                      const selected =
                        splitApps.includes(
                          app.packageName
                        );

                      return (
                        <TouchableOpacity
                          key={
                            app.packageName
                          }
                          style={[
                            styles.commonAppButton,
                            selected &&
                              styles.commonAppButtonSelected,
                          ]}
                          onPress={() =>
                            selected
                              ? removeApplication(
                                  app.packageName
                                )
                              : addCommonApplication(
                                  app.packageName
                                )
                          }
                        >

                          <Text
                            style={[
                              styles.commonAppText,
                              selected &&
                                styles.commonAppTextSelected,
                            ]}
                          >
                            {app.name}
                          </Text>

                          {selected && (
                            <Check
                              size={14}
                              color="#00E5FF"
                            />
                          )}

                        </TouchableOpacity>
                      );
                    }
                  )}

                </View>


                {/* CUSTOM APP INPUT */}

                <View
                  style={
                    styles.inputRow
                  }
                >

                  <TextInput
                    style={
                      styles.textInput
                    }
                    value={appInput}
                    onChangeText={
                      setAppInput
                    }
                    placeholder="com.example.app"
                    placeholderTextColor="#4A5A70"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />


                  <TouchableOpacity
                    style={
                      styles.addButton
                    }
                    onPress={
                      addApplication
                    }
                  >
                    <Plus
                      size={20}
                      color="#06101D"
                    />
                  </TouchableOpacity>

                </View>


                {/* SELECTED APPS */}

                {splitApps.length > 0 && (
                  <View
                    style={
                      styles.selectedContainer
                    }
                  >

                    <Text
                      style={
                        styles.selectedHeader
                      }
                    >
                      Selected applications
                    </Text>


                    {splitApps.map(
                      (packageName) => (
                        <View
                          key={
                            packageName
                          }
                          style={
                            styles.selectedItem
                          }
                        >

                          <View
                            style={
                              styles.selectedItemLeft
                            }
                          >

                            <Smartphone
                              size={15}
                              color="#6C7C93"
                            />

                            <Text
                              style={
                                styles.selectedItemText
                              }
                              numberOfLines={1}
                            >
                              {packageName}
                            </Text>

                          </View>


                          <TouchableOpacity
                            onPress={() =>
                              removeApplication(
                                packageName
                              )
                            }
                          >

                            <X
                              size={18}
                              color="#6C7C93"
                            />

                          </TouchableOpacity>

                        </View>
                      )
                    )}

                  </View>
                )}

              </View>


              {/* =================================================
                  WEBSITES
              ================================================== */}

              <View
                style={
                  styles.splitSubSection
                }
              >

                <View
                  style={
                    styles.splitSectionTitle
                  }
                >

                  <Globe
                    size={18}
                    color="#00E5FF"
                  />

                  <Text
                    style={
                      styles.splitSectionTitleText
                    }
                  >
                    Websites / Domains
                  </Text>

                </View>


                <Text
                  style={
                    styles.splitHelpText
                  }
                >
                  Add domains such as youtube.com
                  or google.com. The native VPN
                  routing engine must support domain
                  rules for these settings to take
                  effect.
                </Text>


                {/* DOMAIN INPUT */}

                <View
                  style={
                    styles.inputRow
                  }
                >

                  <TextInput
                    style={
                      styles.textInput
                    }
                    value={domainInput}
                    onChangeText={
                      setDomainInput
                    }
                    placeholder="youtube.com"
                    placeholderTextColor="#4A5A70"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />


                  <TouchableOpacity
                    style={
                      styles.addButton
                    }
                    onPress={
                      addDomain
                    }
                  >

                    <Plus
                      size={20}
                      color="#06101D"
                    />

                  </TouchableOpacity>

                </View>


                {/* SELECTED DOMAINS */}

                {splitDomains.length >
                  0 && (
                  <View
                    style={
                      styles.selectedContainer
                    }
                  >

                    <Text
                      style={
                        styles.selectedHeader
                      }
                    >
                      Selected domains
                    </Text>


                    {splitDomains.map(
                      (domain) => (
                        <View
                          key={domain}
                          style={
                            styles.selectedItem
                          }
                        >

                          <View
                            style={
                              styles.selectedItemLeft
                            }
                          >

                            <Globe
                              size={15}
                              color="#6C7C93"
                            />

                            <Text
                              style={
                                styles.selectedItemText
                              }
                            >
                              {domain}
                            </Text>

                          </View>


                          <TouchableOpacity
                            onPress={() =>
                              removeDomain(
                                domain
                              )
                            }
                          >

                            <X
                              size={18}
                              color="#6C7C93"
                            />

                          </TouchableOpacity>

                        </View>
                      )
                    )}

                  </View>
                )}

              </View>


              {/* NATIVE WARNING */}

              {Platform.OS === 'web' && (
                <View
                  style={
                    styles.webWarning
                  }
                >

                  <Text
                    style={
                      styles.webWarningTitle
                    }
                  >
                    Android VPN required
                  </Text>

                  <Text
                    style={
                      styles.webWarningText
                    }
                  >
                    Split tunneling cannot control
                    Android VPN traffic from Expo
                    Web. Build and run the Android
                    native VPN service to apply these
                    rules.
                  </Text>

                </View>
              )}

            </View>
          )}

        </View>


        {/* =====================================================
            DNS
        ====================================================== */}

        <View style={styles.sectionBlock}>

          <Text
            style={styles.sectionHeader}
          >
            {t.dns || 'DNS'}
          </Text>


          <TouchableOpacity
            style={[
              styles.languageCardRow,
              isDnsOpen &&
                styles.dropdownCardRowActive,
            ]}
            onPress={() =>
              setIsDnsOpen(
                !isDnsOpen
              )
            }
          >

            <View
              style={styles.rowLeftBlock}
            >

              <View
                style={
                  styles.dnsBoxIndicator
                }
              />

              <View
                style={styles.textColumn}
              >

                <Text
                  style={
                    styles.mainItemText
                  }
                >
                  {t.primaryDns ||
                    'Primary DNS'}
                </Text>

                <Text
                  style={
                    styles.subItemDescText
                  }
                >
                  {primaryDns}
                </Text>

              </View>

            </View>


            {isDnsOpen ? (
              <ChevronUp
                size={20}
                color="#00E5FF"
              />
            ) : (
              <ChevronDown
                size={20}
                color="#4A5A70"
              />
            )}

          </TouchableOpacity>


          {isDnsOpen && (
            <View
              style={
                styles.dropdownOpenContainer
              }
            >

              {DNS_OPTIONS.map(
                (opt, index) => {

                  const isSelected =
                    opt.value ===
                    primaryDns;

                  return (
                    <View
                      key={opt.id}
                    >

                      <TouchableOpacity
                        style={[
                          styles.dropdownItemRow,
                          isSelected &&
                            styles.dropdownItemRowSelected,
                        ]}
                        onPress={() =>
                          onSelectPrimaryDns(
                            opt.value
                          )
                        }
                      >

                        <Text
                          style={[
                            styles.dropdownItemText,
                            isSelected &&
                              styles.dropdownItemTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>


                        {isSelected && (
                          <Check
                            size={16}
                            color="#00E5FF"
                          />
                        )}

                      </TouchableOpacity>


                      {index <
                        DNS_OPTIONS.length -
                          1 && (
                        <View
                          style={
                            styles.innerDividerLine
                          }
                        />
                      )}

                    </View>
                  );
                }
              )}

            </View>
          )}


          {/* SECONDARY DNS */}

          <View
            style={[
              styles.groupCardContainer,
              {
                marginTop: 12,
              },
            ]}
          >

            <View
              style={styles.staticDataRow}
            >

              <View
                style={styles.rowLeftBlock}
              >

                <View
                  style={
                    styles.dnsBoxIndicator
                  }
                />

                <Text
                  style={
                    styles.mainItemText
                  }
                >
                  {t.secondaryDns ||
                    'Secondary DNS'}
                </Text>

              </View>


              <Text
                style={
                  styles.staticNetworkValueText
                }
              >
                {secondaryDns}
              </Text>

            </View>

          </View>

        </View>


        <View
          style={{
            height: 100,
          }}
        />

      </ScrollView>
    </SafeAreaView>
  );
}


/* ==============================================================
   STYLES
============================================================== */

const styles = StyleSheet.create({

  tabCanvas: {
    flex: 1,
    backgroundColor: '#090F1B',
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollWrapper: {
    flex: 1,
  },

  pageHeaderWrapper: {
    paddingHorizontal: 20,
    paddingTop: 20,
    marginTop: 15,
    marginBottom: 10,
  },

  pageTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  sectionBlock: {
    marginTop: 24,
    paddingHorizontal: 20,
  },

  sectionHeader: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingLeft: 4,
  },

  groupCardContainer: {
    backgroundColor: '#111A2E',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#16233B',
    overflow: 'hidden',
  },

  innerDividerLine: {
    height: 1,
    backgroundColor: '#16233B',
    marginHorizontal: 16,
  },

  menuCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#16233B',
  },

  switchCardRowSingle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#16233B',
  },

  switchCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },

  staticDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },

  languageCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#16233B',
  },

  dropdownCardRowActive: {
    borderColor: '#00E5FF',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  dropdownOpenContainer: {
    backgroundColor: '#111A2E',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#00E5FF',
    overflow: 'hidden',
  },

  dropdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },

  dropdownItemRowSelected: {
    backgroundColor: '#13233C',
  },

  dropdownItemText: {
    color: '#687690',
    fontSize: 14,
    fontWeight: '500',
  },

  dropdownItemTextActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },

  rowLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },

  textColumn: {
    justifyContent: 'center',
    flex: 1,
    paddingRight: 8,
  },

  mainItemText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },

  subItemDescText: {
    color: '#556982',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 16,
  },

  staticNetworkValueText: {
    color: '#4A5A70',
    fontSize: 14,
    fontWeight: '600',
  },

  cloudIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#7016FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  dnsBoxIndicator: {
    width: 14,
    height: 8,
    borderRadius: 3,
    backgroundColor: '#3A4D62',
  },

  rotatedIcon: {
    transform: [
      {
        rotate: '180deg',
      },
    ],
  },


  /* ============================================================
     SPLIT TUNNEL
  ============================================================ */

  splitConfiguration: {
    marginTop: 10,
    gap: 10,
  },

  splitSubSection: {
    backgroundColor: '#0D1728',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#16233B',
    padding: 16,
  },

  splitSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },

  splitSectionTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  splitHelpText: {
    color: '#556982',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },


  /* ============================================================
     MODE
  ============================================================ */

  modeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 17,
    paddingHorizontal: 20,
  },

  modeTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  modeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  modeDescription: {
    color: '#556982',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },


  /* ============================================================
     COMMON APPS
  ============================================================ */

  commonAppsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  commonAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1C2B42',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },

  commonAppButtonSelected: {
    borderColor: '#00E5FF',
    backgroundColor: '#132B3D',
  },

  commonAppText: {
    color: '#71829A',
    fontSize: 12,
    fontWeight: '600',
  },

  commonAppTextSelected: {
    color: '#00E5FF',
  },


  /* ============================================================
     INPUT
  ============================================================ */

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  textInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1C2B42',
    borderRadius: 12,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 13,
  },

  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },


  /* ============================================================
     SELECTED ITEMS
  ============================================================ */

  selectedContainer: {
    marginTop: 16,
  },

  selectedHeader: {
    color: '#687690',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111A2E',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },

  selectedItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },

  selectedItemText: {
    color: '#B7C3D4',
    fontSize: 12,
    flex: 1,
  },


  /* ============================================================
     WEB WARNING
  ============================================================ */

  webWarning: {
    backgroundColor: '#211B0B',
    borderWidth: 1,
    borderColor: '#594A1A',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },

  webWarningTitle: {
    color: '#FFD76A',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },

  webWarningText: {
    color: '#A89765',
    fontSize: 11,
    lineHeight: 17,
  },
});