package terminal_service

import (
	"context"
	"encoding/json"
	"io"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"k8s.io/client-go/tools/remotecommand"

	"github.com/unbindapp/unbind-api/internal/common/log"
	"github.com/unbindapp/unbind-api/internal/infrastructure/k8s"
)

const (
	pingInterval = 30 * time.Second
	writeTimeout = 10 * time.Second
)

// Browser input and resize events.
type clientMessage struct {
	Type string `json:"type"`
	Data string `json:"data,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

// Control events to the browser; terminal output goes as raw binary frames.
type serverMessage struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}

// Attach pumps the websocket to/from the pod until either side closes. The target must
// already be authorized via Resolve.
func (self *TerminalService) Attach(ctx context.Context, ws *websocket.Conn, bearerToken string, target *ExecTarget) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	conn := newWSConn(ws)
	defer conn.close()

	stdinReader, stdinWriter := io.Pipe()
	resize := &terminalSizeQueue{ch: make(chan remotecommand.TerminalSize, 4)}

	go conn.readPump(ctx, cancel, stdinWriter, resize)
	go conn.keepAlive(ctx)

	err := self.k8s.ExecInPod(ctx, bearerToken, k8s.ExecOptions{
		Namespace: target.Namespace,
		PodName:   target.PodName,
		Container: target.Container,
		Command:   target.Command,
		TTY:       true,
		Stdin:     stdinReader,
		Stdout:    conn.stdout(),
		Stderr:    conn.stdout(),
		Resize:    resize,
	})

	_ = stdinWriter.Close()

	if err != nil && ctx.Err() == nil {
		log.Warnf("terminal exec ended: %v", err)
		conn.sendControl(serverMessage{Type: "error", Message: err.Error()})
		return
	}
	conn.sendControl(serverMessage{Type: "exit"})
}

// wsConn serializes all writes to one websocket connection.
type wsConn struct {
	ws  *websocket.Conn
	mu  sync.Mutex
	out *wsWriter
}

func newWSConn(ws *websocket.Conn) *wsConn {
	c := &wsConn{ws: ws}
	c.out = &wsWriter{conn: c}
	return c
}

func (c *wsConn) stdout() io.Writer { return c.out }

func (c *wsConn) writeMessage(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	_ = c.ws.SetWriteDeadline(time.Now().Add(writeTimeout))
	return c.ws.WriteMessage(messageType, data)
}

func (c *wsConn) sendControl(msg serverMessage) {
	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}
	_ = c.writeMessage(websocket.TextMessage, payload)
}

func (c *wsConn) close() {
	_ = c.writeMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
	_ = c.ws.Close()
}

func (c *wsConn) readPump(ctx context.Context, cancel context.CancelFunc, stdin *io.PipeWriter, resize *terminalSizeQueue) {
	defer cancel()
	defer resize.close()
	defer func() { _ = stdin.Close() }()

	for {
		if ctx.Err() != nil {
			return
		}

		messageType, data, err := c.ws.ReadMessage()
		if err != nil {
			return
		}

		if messageType == websocket.BinaryMessage {
			if _, err := stdin.Write(data); err != nil {
				return
			}
			continue
		}

		var msg clientMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "stdin":
			if _, err := stdin.Write([]byte(msg.Data)); err != nil {
				return
			}
		case "resize":
			resize.push(remotecommand.TerminalSize{Width: msg.Cols, Height: msg.Rows})
		}
	}
}

func (c *wsConn) keepAlive(ctx context.Context) {
	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.writeMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// wsWriter sends pod stdout/stderr as binary websocket frames.
type wsWriter struct {
	conn *wsConn
}

func (w *wsWriter) Write(p []byte) (int, error) {
	if err := w.conn.writeMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

type terminalSizeQueue struct {
	ch     chan remotecommand.TerminalSize
	closed sync.Once
}

func (q *terminalSizeQueue) Next() *remotecommand.TerminalSize {
	size, ok := <-q.ch
	if !ok {
		return nil
	}
	return &size
}

func (q *terminalSizeQueue) push(size remotecommand.TerminalSize) {
	select {
	case q.ch <- size:
	default:
	}
}

func (q *terminalSizeQueue) close() {
	q.closed.Do(func() { close(q.ch) })
}
