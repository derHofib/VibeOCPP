// What a technician has to enter on the charge point itself so it connects
// to this CSMS. The backend never sees the public OCPP address (CitrineOS
// reaches it as `citrine:8080` inside Docker), so it is derived from the
// host the operator is browsing — correct whenever the charger can reach
// the same address the UI is served from — with VITE_OCPP_WS_URL as the
// explicit override for deployments where it can't.
const DEFAULT_OCPP_WS_PORT = '8081';

// Port 8081 is CitrineOS's unauthenticated websocket listener
// (securityProfile 0, allowUnknownChargingStations: true).
const SECURITY_PROFILE_0 = 0;

const SUBPROTOCOLS: Record<string, string> = {
  '1.6': 'ocpp1.6',
  '2.0.1': 'ocpp2.0.1',
  '2.1': 'ocpp2.1',
};

export interface ParameterStation {
  chargeboxId: string;
  ocppVersion: string | null;
}

export interface ParameterConnector {
  id: string;
  label: string;
  evseId: number;
  connectorId: number;
  type: string;
  format: 'Socket' | 'Cable';
}

export interface StationParameters {
  serverUrl: string;
  chargePointId: string;
  fullUrl: string;
  ocppVersion: string | null;
  subprotocol: string | null;
  securityProfile: number;
  connectors: ParameterConnector[];
}

export function resolveOcppBaseUrl(
  override: string | undefined = import.meta.env.VITE_OCPP_WS_URL,
  hostname: string = window.location.hostname,
  port: string = import.meta.env.VITE_OCPP_WS_PORT ?? DEFAULT_OCPP_WS_PORT,
): string {
  if (override) return stripTrailingSlash(override);
  // An IPv6 literal must stay bracketed inside a URL authority.
  const host = hostname.includes(':') ? `[${hostname}]` : hostname;
  return `ws://${host}:${port}`;
}

export function buildStationParameters(
  station: ParameterStation,
  connectors: ParameterConnector[],
  baseUrl: string,
): StationParameters {
  const serverUrl = stripTrailingSlash(baseUrl);
  return {
    serverUrl,
    chargePointId: station.chargeboxId,
    fullUrl: `${serverUrl}/${station.chargeboxId}`,
    ocppVersion: station.ocppVersion,
    subprotocol: station.ocppVersion ? (SUBPROTOCOLS[station.ocppVersion] ?? null) : null,
    securityProfile: SECURITY_PROFILE_0,
    connectors: [...connectors].sort((a, b) => a.evseId - b.evseId || a.connectorId - b.connectorId),
  };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

// navigator.clipboard only exists in secure contexts (https or localhost),
// but this UI is routinely opened over plain http on a LAN address
// (http://192.168.x.x:5173) — there it is undefined, so fall back to the
// legacy execCommand path instead of silently doing nothing.
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // permission denied or document not focused — try the fallback below
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}
