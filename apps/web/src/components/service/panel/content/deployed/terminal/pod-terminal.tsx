import "@xterm/xterm/css/xterm.css";

import { useAppConfig } from "@/components/providers/app-config-provider";
import { TTerminalStatus } from "@/components/service/panel/content/deployed/terminal/terminal-status";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

export type TPodTerminalHandle = {
  reconnect: () => void;
};

type TProps = {
  teamId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  podName: string;
  container: string;
  onStatusChange: (status: TTerminalStatus) => void;
};

function buildWsUrl(apiUrl: string, params: URLSearchParams) {
  const url = new URL(apiUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/terminal/exec`;
  url.search = params.toString();
  return url.toString();
}

// navigator.clipboard is undefined on insecure origins (LAN IP in dev), so keep the execCommand fallback.
function copyText(text: string) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCopy(text));
    return;
  }
  execCopy(text);
}

function execCopy(text: string) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    // squish
  }
  document.body.removeChild(ta);
}

// xterm wants real colors, not our CSS vars — make the browser resolve them to rgb().
function resolveColor(probe: HTMLElement, cssVar: string) {
  probe.style.color = `var(${cssVar})`;
  return getComputedStyle(probe).color;
}

function readTheme(host: HTMLElement) {
  const probe = document.createElement("span");
  probe.style.display = "none";
  host.appendChild(probe);
  const background = resolveColor(probe, "--background");
  const foreground = resolveColor(probe, "--foreground");
  const cursor = resolveColor(probe, "--foreground");
  const selectionBackground = resolveColor(probe, "--muted");
  host.removeChild(probe);
  return { background, foreground, cursor, cursorAccent: background, selectionBackground };
}

const PodTerminal = forwardRef<TPodTerminalHandle, TProps>(function PodTerminal(props, ref) {
  const { apiUrl } = useAppConfig();
  const { teamId, projectId, environmentId, serviceId, podName, container } = props;

  const elementRef = useRef<HTMLDivElement>(null);
  const reconnectRef = useRef<() => void>(() => {});
  // latest callback, without retriggering the effect
  const onStatusChangeRef = useRef(props.onStatusChange);
  onStatusChangeRef.current = props.onStatusChange;

  useImperativeHandle(ref, () => ({ reconnect: () => reconnectRef.current() }), []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.2,
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      theme: readTheme(element),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(element);
    // Pad the terminal's own box (not the host) so the gap is part of the terminal:
    // the last line always clears the bottom edge and the scrollbar stays flush to the
    // panel edge. FitAddon reads this element's padding, so the grid stays correct.
    if (term.element) term.element.style.padding = "0.5rem";
    fit.fit();

    const themeObserver = new MutationObserver(() => {
      term.options.theme = readTheme(element);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // The Terminal (and its scrollback) survives reconnects; only the socket is recreated.
    // Transient drops back off and retry — a real exit/error stays dead.
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;
    let ended = false;

    // The server sets a short CWD-only prompt at exec, so just stream output through.
    const decoder = new TextDecoder();
    const writeOutput = (bytes: Uint8Array) => {
      term.write(decoder.decode(bytes, { stream: true }));
    };

    const setStatus = (status: TTerminalStatus) => onStatusChangeRef.current(status);
    const send = (msg: object) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    };
    const sendResize = () => send({ type: "resize", cols: term.cols, rows: term.rows });

    const connect = () => {
      if (disposed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ended = false;
      setStatus(attempt === 0 ? "connecting" : "reconnecting");

      const params = new URLSearchParams({
        team_id: teamId,
        project_id: projectId,
        environment_id: environmentId,
        service_id: serviceId,
        pod_name: podName,
        container,
      });
      ws = new WebSocket(buildWsUrl(apiUrl, params));
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        attempt = 0;
        setStatus("connected");
        fit.fit();
        sendResize();
        term.focus();
      };

      ws.onmessage = (e) => {
        if (typeof e.data !== "string") {
          writeOutput(new Uint8Array(e.data as ArrayBuffer));
          return;
        }
        let msg: { type?: string; message?: string };
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "error":
            term.write(`\r\n\x1b[31m${msg.message ?? "connection error"}\x1b[0m\r\n`);
            ended = true;
            break;
          case "exit":
            term.write("\r\n\x1b[90mSession ended.\x1b[0m\r\n");
            ended = true;
            break;
        }
      };

      ws.onerror = () => {
        // onclose does the recovery
      };

      ws.onclose = (event) => {
        if (disposed) return;
        // Only abnormal closes (1006 network/proxy drop) reconnect; a clean close was on purpose.
        const cleanClose = event.code === 1000 || event.code === 1001;
        if (ended || cleanClose) {
          setStatus("disconnected");
          return;
        }
        console.warn(`pod terminal socket closed (code ${event.code})`, event.reason);
        setStatus("reconnecting");
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    reconnectRef.current = () => {
      attempt = 0;
      ended = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      connect();
    };

    const onMouseUp = () => {
      const selection = term.getSelection();
      if (selection) copyText(selection);
    };
    element.addEventListener("mouseup", onMouseUp);

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      if (!e.ctrlKey && !e.metaKey) return true;
      const key = e.key.toLowerCase();

      // Returning false lets the browser paste natively into xterm's textarea — Firefox
      // won't give us clipboard.readText(), so this is the only cross-browser path.
      if (key === "v" && (e.metaKey || e.shiftKey)) {
        return false;
      }

      // preventDefault or Chrome eats Ctrl+Shift+C to open DevTools instead of copying.
      if (key === "c" && (e.metaKey || e.shiftKey)) {
        const selection = term.getSelection();
        if (selection) {
          e.preventDefault();
          e.stopPropagation();
          copyText(selection);
          return false;
        }
      }
      return true;
    });

    const dataListener = term.onData((data) => send({ type: "stdin", data }));
    const resizeListener = term.onResize(() => sendResize());

    const observer = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // squish
      }
    });
    observer.observe(element);

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      element.removeEventListener("mouseup", onMouseUp);
      themeObserver.disconnect();
      observer.disconnect();
      dataListener.dispose();
      resizeListener.dispose();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      term.dispose();
    };
  }, [apiUrl, teamId, projectId, environmentId, serviceId, podName, container]);

  return <div ref={elementRef} className="bg-background min-h-0 w-full flex-1 overflow-hidden" />;
});

export default PodTerminal;
