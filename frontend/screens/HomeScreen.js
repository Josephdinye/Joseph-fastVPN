import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Gauge,
  Globe2,
  Lock,
  MapPin,
  RefreshCw,
  Shield,
  ShieldCheck,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react-native';

import { translations } from '../App';

/* ============================================================
   VPN ENGINE
============================================================ */

let XrayClient = null;

try {
  XrayClient = require('react-native-nitro-xray-core').XrayClient;
} catch (e) {
  console.log('XrayClient not available in this environment');
}

/* ============================================================
   CONSTANTS
============================================================ */

const STORAGE_KEYS = {
  SELECTED_SERVER: '@joseph_fastvpn_selected_server',
  CONNECTION_STARTED_AT: '@joseph_fastvpn_connection_started_at',
  ALL_LINKS: '@joseph_fastvpn_all_links',
};

const VPN_STATES = {
  DISCONNECTED: 'DISCONNECTED',
  ROUTING: 'ROUTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
};

const { width: SCREEN_W } = Dimensions.get('window');

const RING = Math.min(SCREEN_W * 0.52, 210);
const INNER = RING - 22;
const BTN = INNER - 24;

/* ============================================================
   AUTO SERVER
============================================================ */

/*
 * IMPORTANT:
 *
 * Auto is now the default state.
 *
 * We intentionally do NOT restore a previously selected
 * manual server when the application starts.
 *
 * This prevents a server such as Bulgaria from becoming the
 * default server after restarting the application.
 */

const DEFAULT_AUTO = {
  id: 'auto-fastest',
  name: 'Auto · Fastest',
  isAuto: true,
  rawConfig: null,
  protocol: 'AUTO',
};

/* ============================================================
   HELPERS
============================================================ */

const normalizeIso = (iso) => {
  if (!iso) return null;

  const n = String(iso)
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 2);

  return n.length === 2 ? n : null;
};

const getFlagUrl = (iso) => {
  const n = normalizeIso(iso);

  return n
    ? `https://flagcdn.com/w40/${n}.png`
    : null;
};

const getNodeName = (node) => {
  if (!node) return 'Auto · Fastest';

  if (node.isAuto) {
    return 'Auto · Fastest';
  }

  return (
    node.name ||
    node.country ||
    node.serverName ||
    node.title ||
    'Selected Server'
  );
};

const getNodeLocation = (node) => {
  if (!node || node.isAuto) return null;

  return (
    node.country ||
    node.location ||
    node.city ||
    node.subtitle ||
    null
  );
};

const getNodeProtocol = (node) => {
  if (!node) return null;

  return (
    node.protocol ||
    node.type ||
    node.network ||
    'VLESS'
  );
};

const getNodeLatency = (node) => {
  if (!node) return null;

  const value =
    node.latency ??
    node.ping ??
    node.delay ??
    node.responseTime;

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
};

const formatDuration = (seconds) => {
  const value = Math.max(
    0,
    Math.floor(seconds || 0)
  );

  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;

  return [h, m, s]
    .map((x) => String(x).padStart(2, '0'))
    .join(':');
};

const formatBytes = (bytes) => {
  if (
    bytes == null ||
    !Number.isFinite(Number(bytes))
  ) {
    return '--';
  }

  const value = Number(bytes);

  if (value < 1024) {
    return `${value.toFixed(0)} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;
};

const formatSpeed = (bps) => {
  if (
    bps == null ||
    !Number.isFinite(Number(bps))
  ) {
    return '--';
  }

  const value = Number(bps);

  if (value < 1024) {
    return `${value.toFixed(0)} B/s`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB/s`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(1)} MB/s`;
  }

  return `${(
    value /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB/s`;
};

/* ============================================================
   HOME SCREEN
============================================================ */

export default function HomeScreen({
  route,
  navigation,
  appLang,
}) {
  const t =
    translations?.[appLang || 'EN'] ||
    translations?.EN ||
    {};

  const [vpnState, setVpnState] = useState(
    VPN_STATES.DISCONNECTED
  );

  /*
   * AUTO IS ALWAYS THE INITIAL STATE.
   */
  const [activeNode, setActiveNode] =
    useState(DEFAULT_AUTO);

  const [isAutoSelect, setIsAutoSelect] =
    useState(true);

  const [connectionStartedAt, setConnectionStartedAt] =
    useState(null);

  const [durationSec, setDurationSec] =
    useState(0);

  const [uploadSpeed, setUploadSpeed] =
    useState(null);

  const [downloadSpeed, setDownloadSpeed] =
    useState(null);

  const [totalUp, setTotalUp] =
    useState(null);

  const [totalDown, setTotalDown] =
    useState(null);

  const [connectionError, setConnectionError] =
    useState(null);

  const [loadingServer, setLoadingServer] =
    useState(true);

  const [connecting, setConnecting] =
    useState(false);

  const timerRef = useRef(null);

  const lastStatsRef = useRef({
    up: 0,
    down: 0,
    at: 0,
  });

  /* ==========================================================
     RESET TO AUTO
  ========================================================== */

  const resetToAuto = useCallback(
    async () => {
      setActiveNode(DEFAULT_AUTO);
      setIsAutoSelect(true);

      /*
       * Save AUTO rather than the previous manual server.
       *
       * This means reopening the application will show:
       *
       * Auto · Fastest
       *
       * instead of a previously used country.
       */
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SELECTED_SERVER,
          JSON.stringify(DEFAULT_AUTO)
        );
      } catch (error) {
        console.warn(
          'Could not save Auto server',
          error
        );
      }
    },
    []
  );

  /* ==========================================================
     INITIAL SERVER
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    /*
     * IMPORTANT:
     *
     * We no longer restore an old server here.
     *
     * The application always starts in Auto · Fastest mode.
     */

    (async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SELECTED_SERVER,
          JSON.stringify(DEFAULT_AUTO)
        );

        if (mounted) {
          setActiveNode(DEFAULT_AUTO);
          setIsAutoSelect(true);
        }
      } catch (error) {
        console.warn(
          'Initialize Auto server',
          error
        );
      } finally {
        if (mounted) {
          setLoadingServer(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ==========================================================
     SERVER SCREEN SELECTION
  ========================================================== */

  useEffect(() => {
    const selected =
      route?.params?.selectedNode;

    if (!selected) return;

    /*
     * Allow Auto selection.
     */
    if (selected.isAuto) {
      setActiveNode(DEFAULT_AUTO);
      setIsAutoSelect(true);

      AsyncStorage.setItem(
        STORAGE_KEYS.SELECTED_SERVER,
        JSON.stringify(DEFAULT_AUTO)
      ).catch(() => {});

      navigation?.setParams?.({
        selectedNode: undefined,
      });

      return;
    }

    /*
     * Manual server must contain a configuration.
     */
    if (!selected.rawConfig) {
      Alert.alert(
        'Invalid server',
        'This server has no VPN configuration.'
      );

      return;
    }

    setActiveNode(selected);
    setIsAutoSelect(false);

    AsyncStorage.setItem(
      STORAGE_KEYS.SELECTED_SERVER,
      JSON.stringify(selected)
    ).catch(() => {});

    navigation?.setParams?.({
      selectedNode: undefined,
    });
  }, [
    route?.params?.selectedNode,
    navigation,
  ]);

  /* ==========================================================
     RESTORE CONNECTION TIME
  ========================================================== */

  useEffect(() => {
    (async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            STORAGE_KEYS.CONNECTION_STARTED_AT
          );

        if (!saved) return;

        const timestamp = Number(saved);

        if (Number.isFinite(timestamp)) {
          setConnectionStartedAt(timestamp);
        }
      } catch {}
    })();
  }, []);

  /* ==========================================================
     DURATION TIMER
  ========================================================== */

  useEffect(() => {
    if (
      vpnState !== VPN_STATES.CONNECTED ||
      !connectionStartedAt
    ) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      return;
    }

    const tick = () => {
      setDurationSec(
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              connectionStartedAt) /
              1000
          )
        )
      );
    };

    tick();

    timerRef.current = setInterval(
      tick,
      1000
    );

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    vpnState,
    connectionStartedAt,
  ]);

  /* ==========================================================
     TRAFFIC STATS
  ========================================================== */

  const refreshTrafficStats =
    useCallback(async () => {
      if (
        !XrayClient ||
        vpnState !== VPN_STATES.CONNECTED
      ) {
        return;
      }

      try {
        let stats = null;

        if (
          typeof XrayClient.stats ===
          'function'
        ) {
          stats =
            await XrayClient.stats();
        } else if (
          typeof XrayClient.getStats ===
          'function'
        ) {
          stats =
            await XrayClient.getStats();
        }

        if (!stats) return;

        const upBytes = Number(
          stats.uplink ??
            stats.uploadBytes ??
            0
        );

        const downBytes = Number(
          stats.downlink ??
            stats.downloadBytes ??
            0
        );

        const now = Date.now();

        if (Number.isFinite(upBytes)) {
          setTotalUp(upBytes);
        }

        if (Number.isFinite(downBytes)) {
          setTotalDown(downBytes);
        }

        const last =
          lastStatsRef.current;

        if (last.at > 0) {
          const dt =
            (now - last.at) / 1000;

          if (dt > 0.4) {
            setUploadSpeed(
              Math.max(
                0,
                (upBytes - last.up) / dt
              )
            );

            setDownloadSpeed(
              Math.max(
                0,
                (downBytes - last.down) /
                  dt
              )
            );
          }
        }

        lastStatsRef.current = {
          up: upBytes,
          down: downBytes,
          at: now,
        };
      } catch (error) {
        console.warn(
          'Traffic stats',
          error
        );
      }
    }, [vpnState]);

  useEffect(() => {
    if (
      vpnState !==
      VPN_STATES.CONNECTED
    ) {
      return;
    }

    refreshTrafficStats();

    const id = setInterval(
      refreshTrafficStats,
      1000
    );

    return () => clearInterval(id);
  }, [
    vpnState,
    refreshTrafficStats,
  ]);

  /* ==========================================================
     RESET SESSION
  ========================================================== */

  const resetSession = () => {
    setDurationSec(0);
    setUploadSpeed(null);
    setDownloadSpeed(null);
    setTotalUp(null);
    setTotalDown(null);

    lastStatsRef.current = {
      up: 0,
      down: 0,
      at: 0,
    };
  };

  /* ==========================================================
     CONNECTION STORAGE
  ========================================================== */

  const saveConnectionStart =
    async () => {
      const timestamp = Date.now();

      setConnectionStartedAt(
        timestamp
      );

      setDurationSec(0);

      await AsyncStorage.setItem(
        STORAGE_KEYS.CONNECTION_STARTED_AT,
        String(timestamp)
      );
    };

  const clearConnectionStart =
    async () => {
      setConnectionStartedAt(null);
      setDurationSec(0);

      await AsyncStorage.removeItem(
        STORAGE_KEYS.CONNECTION_STARTED_AT
      );
    };

  /* ==========================================================
     CONNECT VPN
  ========================================================== */

  const connectVpn = async () => {
    if (
      connecting ||
      vpnState === VPN_STATES.ROUTING
    ) {
      return;
    }

    setConnectionError(null);

    if (!XrayClient) {
      const message =
        Platform.OS === 'web'
          ? 'VPN engine is not available on Web. Install the Android APK.'
          : 'VPN engine is not available in this build.';

      setVpnState(
        VPN_STATES.ERROR
      );

      setConnectionError(message);

      Alert.alert(
        'VPN unavailable',
        message
      );

      return;
    }

    /*
     * AUTO is true when:
     *
     * - Auto mode was selected
     * - activeNode is Auto
     * - activeNode has no rawConfig
     */
    const useAuto =
      isAutoSelect ||
      activeNode?.isAuto ||
      !activeNode?.rawConfig;

    try {
      setConnecting(true);

      setVpnState(
        VPN_STATES.ROUTING
      );

      resetSession();

      /*
       * Request Android VPN permission.
       */
      await XrayClient.ensurePermission();

      let server = null;

      /* ======================================================
         AUTO FASTEST
      ====================================================== */

      if (useAuto) {
        /*
         * Always make sure the UI remains Auto.
         */
        setActiveNode(DEFAULT_AUTO);
        setIsAutoSelect(true);

        /*
         * Load every available link.
         */
        const raw =
          await AsyncStorage.getItem(
            STORAGE_KEYS.ALL_LINKS
          );

        const allLinks = raw
          ? JSON.parse(raw)
          : [];

        if (
          !Array.isArray(allLinks) ||
          allLinks.length === 0
        ) {
          throw new Error(
            'No servers loaded. Open Servers, tap Refresh, then try again.'
          );
        }

        /*
         * Parse all links.
         */
        const parsed = [];

        for (const link of allLinks) {
          try {
            const parsedLink =
              XrayClient.parseLink(
                link
              );

            if (
              Array.isArray(
                parsedLink
              ) &&
              parsedLink[0]
            ) {
              parsed.push(
                parsedLink[0]
              );
            } else if (
              parsedLink &&
              typeof parsedLink ===
                'object'
            ) {
              parsed.push(
                parsedLink
              );
            }
          } catch (error) {
            console.warn(
              'Could not parse server link',
              error
            );
          }
        }

        if (parsed.length === 0) {
          throw new Error(
            'Could not parse any server links.'
          );
        }

        /*
         * Test all servers and select the
         * lowest-latency reachable server.
         */
        if (
          typeof XrayClient.urlTest ===
          'function'
        ) {
          const ranked =
            await XrayClient.urlTest(
              parsed
            );

          if (
            !Array.isArray(ranked) ||
            ranked.length === 0
          ) {
            throw new Error(
              'No reachable server found. Try again later.'
            );
          }

          /*
           * urlTest is expected to return
           * results sorted by latency.
           */
          server =
            ranked?.[0]?.server ??
            ranked?.[0];

          if (!server) {
            throw new Error(
              'No reachable server found. Try again later.'
            );
          }
        } else {
          /*
           * Fallback if the installed Xray
           * library doesn't provide urlTest.
           */
          server = parsed[0];
        }
      }

      /* ======================================================
         MANUAL SERVER
      ====================================================== */

      else {
        const parsed =
          XrayClient.parseLink(
            activeNode.rawConfig
          );

        server = Array.isArray(parsed)
          ? parsed[0]
          : parsed;

        if (!server) {
          throw new Error(
            'Could not parse this server link.'
          );
        }
      }

      /* ======================================================
         START VPN
      ====================================================== */

      await XrayClient.connect(
        server
      );

      await saveConnectionStart();

      setVpnState(
        VPN_STATES.CONNECTED
      );
    } catch (error) {
      console.error(
        'VPN connect',
        error
      );

      await clearConnectionStart();

      setVpnState(
        VPN_STATES.ERROR
      );

      const message =
        error?.message ||
        'Could not connect. Try another server.';

      setConnectionError(message);

      Alert.alert(
        'Connection failed',
        message
      );
    } finally {
      setConnecting(false);
    }
  };

  /* ==========================================================
     DISCONNECT VPN
  ========================================================== */

  const disconnectVpn = async () => {
    if (connecting) return;

    try {
      setConnecting(true);

      if (
        !XrayClient?.disconnect
      ) {
        throw new Error(
          'Disconnect unavailable.'
        );
      }

      await XrayClient.disconnect();

      await clearConnectionStart();

      resetSession();

      setConnectionError(null);

      setVpnState(
        VPN_STATES.DISCONNECTED
      );

      /*
       * IMPORTANT:
       *
       * Every time the VPN is disconnected,
       * return to Auto · Fastest.
       *
       * This prevents the previous country from
       * becoming the next default.
       */
      await resetToAuto();
    } catch (error) {
      Alert.alert(
        'Disconnect failed',
        error?.message ||
          'Could not disconnect.'
      );
    } finally {
      setConnecting(false);
    }
  };

  /* ==========================================================
     CONNECTION BUTTON
  ========================================================== */

  const handleConnection = () => {
    if (
      vpnState ===
      VPN_STATES.CONNECTED
    ) {
      disconnectVpn();
    } else {
      connectVpn();
    }
  };

  /* ==========================================================
     SERVER SCREEN
  ========================================================== */

  const openServers = () => {
    navigation.navigate(
      'Servers'
    );
  };

  /* ==========================================================
     UI DERIVED STATE
  ========================================================== */

  const serverName = loadingServer
    ? 'Loading…'
    : isAutoSelect ||
      activeNode?.isAuto
    ? t.autoSel ||
      'Auto · Fastest'
    : getNodeName(
        activeNode
      );

  const serverLocation =
    isAutoSelect ||
    activeNode?.isAuto
      ? t.autoDesc ||
        'Lowest latency working server'
      : getNodeLocation(
          activeNode
        );

  const serverFlag =
    isAutoSelect ||
    activeNode?.isAuto
      ? null
      : getFlagUrl(
          activeNode?.iso
        );

  const serverLatency =
    getNodeLatency(
      activeNode
    );

  const serverProtocol =
    isAutoSelect ||
    activeNode?.isAuto
      ? 'AUTO'
      : getNodeProtocol(
          activeNode
        );

  /* ==========================================================
     STATE INFORMATION
  ========================================================== */

  const stateInfo = useMemo(() => {
    switch (vpnState) {
      case VPN_STATES.CONNECTED:
        return {
          title:
            t.protected ||
            'Protected',

          subtitle:
            'Traffic is routed through a secure tunnel',

          color: '#10B981',

          Icon: ShieldCheck,
        };

      case VPN_STATES.ROUTING:
        return {
          title:
            t.connecting ||
            'Connecting…',

          subtitle:
            useAutoLabel(
              isAutoSelect,
              activeNode
            )
              ? 'Finding fastest server…'
              : 'Establishing secure tunnel',

          color: '#F59E0B',

          Icon: Activity,
        };

      case VPN_STATES.ERROR:
        return {
          title:
            'Connection failed',

          subtitle:
            connectionError ||
            'Try another server',

          color: '#EF4444',

          Icon: XCircle,
        };

      default:
        return {
          title:
            t.unprotected ||
            'Unprotected',

          subtitle:
            'Tap CONNECT to secure your connection',

          color: '#64748B',

          Icon: Shield,
        };
    }
  }, [
    vpnState,
    connectionError,
    t,
    isAutoSelect,
    activeNode,
  ]);

  const StateIcon =
    stateInfo.Icon;

  const busy =
    connecting ||
    vpnState ===
      VPN_STATES.ROUTING;

  const buttonTitle =
    vpnState ===
    VPN_STATES.CONNECTED
      ? 'DISCONNECT'
      : busy
      ? 'CONNECTING'
      : 'CONNECT';

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ======================================================
            HEADER
        ====================================================== */}

        <View
          style={styles.header}
        >
          <View
            style={{ flex: 1 }}
          >
            <Text
              style={styles.appName}
            >
              Joseph fastVPN
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Private · Fast · Secure
            </Text>
          </View>

          <View
            style={[
              styles.pill,
              {
                borderColor:
                  stateInfo.color,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor:
                    stateInfo.color,
                },
              ]}
            />

            <Text
              style={[
                styles.pillText,
                {
                  color:
                    stateInfo.color,
                },
              ]}
            >
              {vpnState ===
              VPN_STATES.CONNECTED
                ? 'ON'
                : 'OFF'}
            </Text>
          </View>
        </View>

        {/* ======================================================
            STATUS
        ====================================================== */}

        <View
          style={[
            styles.statusCard,
            {
              borderColor:
                stateInfo.color +
                '40',
            },
          ]}
        >
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor:
                  stateInfo.color +
                  '18',
              },
            ]}
          >
            <StateIcon
              size={22}
              color={
                stateInfo.color
              }
            />
          </View>

          <View
            style={{ flex: 1 }}
          >
            <Text
              style={[
                styles.statusTitle,
                {
                  color:
                    stateInfo.color,
                },
              ]}
            >
              {stateInfo.title}
            </Text>

            <Text
              style={styles.statusSub}
              numberOfLines={2}
            >
              {stateInfo.subtitle}
            </Text>
          </View>
        </View>

        {/* ======================================================
            SERVER
        ====================================================== */}

        <View
          style={styles.sectionRow}
        >
          <Text
            style={styles.sectionLabel}
          >
            VPN SERVER
          </Text>

          <TouchableOpacity
            onPress={
              openServers
            }
            style={
              styles.changeBtn
            }
            hitSlop={8}
          >
            <Text
              style={
                styles.changeText
              }
            >
              {t.change ||
                'Change'}
            </Text>

            <ChevronRight
              size={14}
              color="#00E5FF"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={
            styles.serverCard
          }
          onPress={
            openServers
          }
          activeOpacity={0.85}
        >
          <View
            style={
              styles.serverIcon
            }
          >
            {serverFlag ? (
              <Image
                source={{
                  uri: serverFlag,
                }}
                style={
                  styles.flag
                }
                resizeMode="cover"
              />
            ) : (
              <Zap
                size={20}
                color="#F59E0B"
              />
            )}
          </View>

          <View
            style={
              styles.serverText
            }
          >
            <Text
              style={
                styles.serverName
              }
              numberOfLines={1}
            >
              {serverName}
            </Text>

            <View
              style={
                styles.metaRow
              }
            >
              {serverLocation ? (
                <>
                  <MapPin
                    size={11}
                    color="#687690"
                  />

                  <Text
                    style={
                      styles.meta
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {serverLocation}
                  </Text>
                </>
              ) : (
                <>
                  <Globe2
                    size={11}
                    color="#687690"
                  />

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    Automatic location
                  </Text>
                </>
              )}
            </View>
          </View>

          <ChevronRight
            size={18}
            color="#4A5A70"
          />
        </TouchableOpacity>

        {/* ======================================================
            CONNECT RING
        ====================================================== */}

        <View
          style={styles.ringWrap}
        >
          <View
            style={[
              styles.ringOuter,
              {
                width: RING,
                height: RING,
                borderRadius:
                  RING / 2,
                borderColor:
                  stateInfo.color,
              },
            ]}
          >
            <View
              style={[
                styles.ringMid,
                {
                  width: INNER,
                  height: INNER,
                  borderRadius:
                    INNER / 2,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.ringBtn,
                  {
                    width: BTN,
                    height: BTN,
                    borderRadius:
                      BTN / 2,
                    borderColor:
                      stateInfo.color +
                      '40',
                  },
                ]}
                onPress={
                  handleConnection
                }
                activeOpacity={0.88}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator
                    size="large"
                    color="#00E5FF"
                  />
                ) : (
                  <Lock
                    size={34}
                    color={
                      stateInfo.color
                    }
                  />
                )}

                <Text
                  style={[
                    styles.ringTitle,
                    {
                      color:
                        stateInfo.color,
                    },
                  ]}
                >
                  {buttonTitle}
                </Text>

                <Text
                  style={
                    styles.ringSub
                  }
                >
                  {vpnState ===
                  VPN_STATES.CONNECTED
                    ? 'Tap to disconnect'
                    : busy
                    ? 'Finding fastest server…'
                    : 'Auto · Fastest'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ======================================================
            CONNECTION METRICS
        ====================================================== */}

        <View
          style={styles.sectionRow}
        >
          <Text
            style={styles.sectionLabel}
          >
            CONNECTION
          </Text>

          {vpnState ===
            VPN_STATES.CONNECTED && (
            <View
              style={styles.live}
            >
              <View
                style={
                  styles.liveDot
                }
              />

              <Text
                style={
                  styles.liveText
                }
              >
                LIVE
              </Text>
            </View>
          )}
        </View>

        <View
          style={styles.grid}
        >
          <View
            style={styles.cell}
          >
            <Activity
              size={16}
              color="#00E5FF"
            />

            <Text
              style={
                styles.cellValue
              }
            >
              {vpnState ===
              VPN_STATES.CONNECTED
                ? formatDuration(
                    durationSec
                  )
                : '--:--:--'}
            </Text>

            <Text
              style={
                styles.cellLabel
              }
            >
              DURATION
            </Text>
          </View>

          <View
            style={styles.cell}
          >
            <Gauge
              size={16}
              color="#00E5FF"
            />

            <Text
              style={
                styles.cellValue
              }
            >
              {serverLatency !=
              null
                ? `${serverLatency} ms`
                : '--'}
            </Text>

            <Text
              style={
                styles.cellLabel
              }
            >
              LATENCY
            </Text>
          </View>

          <View
            style={styles.cell}
          >
            <Wifi
              size={16}
              color="#00E5FF"
            />

            <Text
              style={
                styles.cellValueSm
              }
              numberOfLines={1}
            >
              {serverProtocol ||
                '--'}
            </Text>

            <Text
              style={
                styles.cellLabel
              }
            >
              PROTOCOL
            </Text>
          </View>
        </View>

        {/* ======================================================
            TRAFFIC
        ====================================================== */}

        {vpnState ===
          VPN_STATES.CONNECTED && (
          <>
            <View
              style={
                styles.sectionRow
              }
            >
              <Text
                style={
                  styles.sectionLabel
                }
              >
                TRAFFIC
              </Text>

              {!!XrayClient && (
                <TouchableOpacity
                  onPress={
                    refreshTrafficStats
                  }
                  hitSlop={10}
                >
                  <RefreshCw
                    size={14}
                    color="#687690"
                  />
                </TouchableOpacity>
              )}
            </View>

            <View
              style={styles.traffic}
            >
              <View
                style={
                  styles.trafficCol
                }
              >
                <View
                  style={[
                    styles.trafficIcon,
                    {
                      backgroundColor:
                        '#102442',
                    },
                  ]}
                >
                  <ArrowUp
                    size={14}
                    color="#60A5FA"
                  />
                </View>

                <Text
                  style={
                    styles.trafficVal
                  }
                >
                  {formatSpeed(
                    uploadSpeed
                  )}
                </Text>

                <Text
                  style={
                    styles.trafficLab
                  }
                >
                  UPLOAD
                </Text>
              </View>

              <View
                style={
                  styles.vDiv
                }
              />

              <View
                style={
                  styles.trafficCol
                }
              >
                <View
                  style={[
                    styles.trafficIcon,
                    {
                      backgroundColor:
                        '#0D2B24',
                    },
                  ]}
                >
                  <ArrowDown
                    size={14}
                    color="#34D399"
                  />
                </View>

                <Text
                  style={
                    styles.trafficVal
                  }
                >
                  {formatSpeed(
                    downloadSpeed
                  )}
                </Text>

                <Text
                  style={
                    styles.trafficLab
                  }
                >
                  DOWNLOAD
                </Text>
              </View>

              <View
                style={
                  styles.vDiv
                }
              />

              <View
                style={
                  styles.trafficCol
                }
              >
                <Activity
                  size={16}
                  color="#A78BFA"
                />

                <Text
                  style={
                    styles.trafficVal
                  }
                >
                  {formatBytes(
                    totalDown
                  )}
                </Text>

                <Text
                  style={
                    styles.trafficLab
                  }
                >
                  RECEIVED
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ======================================================
            ERROR
        ====================================================== */}

        {vpnState ===
          VPN_STATES.ERROR && (
          <View
            style={
              styles.errorCard
            }
          >
            <XCircle
              size={18}
              color="#EF4444"
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                VPN connection failed
              </Text>

              <Text
                style={
                  styles.errorMsg
                }
              >
                {connectionError ||
                  'Select another server and try again.'}
              </Text>
            </View>
          </View>
        )}

        <View
          style={{ height: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ============================================================
   AUTO LABEL
============================================================ */

function useAutoLabel(
  isAutoSelect,
  activeNode
) {
  return (
    isAutoSelect ||
    activeNode?.isAuto
  );
}

/* ============================================================
   STYLES
============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C14',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  appName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    color: '#52627A',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: '#0D1523',
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1523',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
  },

  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
  },

  statusSub: {
    color: '#607088',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  sectionLabel: {
    color: '#607088',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  changeText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },

  serverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1B2A42',
    borderRadius: 16,
    padding: 13,
  },

  serverIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#18253A',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },

  flag: {
    width: 36,
    height: 26,
    borderRadius: 4,
  },

  serverText: {
    flex: 1,
    marginRight: 8,
  },

  serverName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },

  meta: {
    color: '#687690',
    fontSize: 11,
    flexShrink: 1,
  },

  ringWrap: {
    alignItems: 'center',
    marginVertical: 22,
  },

  ringOuter: {
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  ringMid: {
    borderWidth: 1,
    borderColor: '#18243A',
    backgroundColor: '#0A111D',
    justifyContent: 'center',
    alignItems: 'center',
  },

  ringBtn: {
    backgroundColor: '#0D1726',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  ringTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 10,
  },

  ringSub: {
    color: '#4E6077',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },

  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0C241C',
    borderWidth: 1,
    borderColor: '#154A37',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },

  liveText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  grid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  cell: {
    flex: 1,
    minHeight: 88,
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1B2A42',
    borderRadius: 14,
    padding: 11,
    justifyContent: 'space-between',
  },

  cellValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },

  cellValueSm: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },

  cellLabel: {
    color: '#506078',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  traffic: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111A2E',
    borderWidth: 1,
    borderColor: '#1B2A42',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 8,
  },

  trafficCol: {
    flex: 1,
    alignItems: 'center',
  },

  trafficIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },

  trafficVal: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  trafficLab: {
    color: '#506078',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 3,
  },

  vDiv: {
    width: 1,
    height: 40,
    backgroundColor: '#1B2A42',
  },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#241216',
    borderWidth: 1,
    borderColor: '#54202A',
    borderRadius: 14,
    padding: 12,
    marginTop: 6,
  },

  errorTitle: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '800',
  },

  errorMsg: {
    color: '#9B646B',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
});