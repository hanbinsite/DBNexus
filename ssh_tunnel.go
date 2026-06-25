package main

import (
	"fmt"
	"io"
	"net"
	"os"
	"time"

	"golang.org/x/crypto/ssh"
)

type SSHTunnel struct {
	localPort  int
	remoteHost string
	remotePort int
	listener   net.Listener
	client     *ssh.Client
	done       chan bool
}

func NewSSHTunnel(sshHost string, sshPort int, sshUser string, sshPassword string, keyPath string, remoteHost string, remotePort int) (*SSHTunnel, error) {
	authMethods := []ssh.AuthMethod{}

	if keyPath != "" {
		key, err := os.ReadFile(keyPath)
		if err == nil {
			signer, err := ssh.ParsePrivateKey(key)
			if err == nil {
				authMethods = append(authMethods, ssh.PublicKeys(signer))
			}
		}
	}

	if sshPassword != "" {
		authMethods = append(authMethods, ssh.Password(sshPassword))
	}

	if len(authMethods) == 0 {
		return nil, fmt.Errorf("no SSH auth method available (need password or key)")
	}

	config := &ssh.ClientConfig{
		User:            sshUser,
		Auth:            authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	sshAddr := fmt.Sprintf("%s:%d", sshHost, sshPort)
	client, err := ssh.Dial("tcp", sshAddr, config)
	if err != nil {
		return nil, fmt.Errorf("SSH dial failed: %w", err)
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("local listen failed: %w", err)
	}

	localPort := listener.Addr().(*net.TCPAddr).Port

	tunnel := &SSHTunnel{
		localPort:  localPort,
		remoteHost: remoteHost,
		remotePort: remotePort,
		listener:   listener,
		client:     client,
		done:       make(chan bool),
	}

	go tunnel.forward()

	return tunnel, nil
}

func (t *SSHTunnel) forward() {
	for {
		select {
		case <-t.done:
			return
		default:
		}

		localConn, err := t.listener.Accept()
		if err != nil {
			select {
			case <-t.done:
				return
			default:
				continue
			}
		}

		go func() {
			defer localConn.Close()

			remoteAddr := fmt.Sprintf("%s:%d", t.remoteHost, t.remotePort)
			remoteConn, err := t.client.Dial("tcp", remoteAddr)
			if err != nil {
				return
			}
			defer remoteConn.Close()

			done := make(chan bool, 2)

			go func() {
				io.Copy(remoteConn, localConn)
				done <- true
			}()

			go func() {
				io.Copy(localConn, remoteConn)
				done <- true
			}()

			<-done
		}()
	}
}

func (t *SSHTunnel) LocalPort() int {
	return t.localPort
}

func (t *SSHTunnel) Close() {
	close(t.done)
	t.listener.Close()
	t.client.Close()
}

var activeTunnels = make(map[string]*SSHTunnel)

func (a *App) createSSHTunnelIfNeeded(config Connection) error {
	if !config.SSHEnabled || config.SSHHost == "" {
		return nil
	}

	if _, exists := activeTunnels[config.ID]; exists {
		return nil
	}

	tunnel, err := NewSSHTunnel(
		config.SSHHost,
		config.SSHPort,
		config.SSHUser,
		config.SSHPassword,
		config.SSHKeyPath,
		config.Host,
		config.Port,
	)
	if err != nil {
		return fmt.Errorf("SSH tunnel creation failed: %w", err)
	}

	activeTunnels[config.ID] = tunnel

	GetAuditLogger().Log(AuditLevelInfo, AuditEventConnect,
		fmt.Sprintf("SSH隧道已建立: %s -> %s:%d (local:%d)", config.SSHHost, config.Host, config.Port, tunnel.LocalPort()),
		map[string]interface{}{"ssh_host": config.SSHHost, "target": config.Host},
	)

	return nil
}

func (a *App) CloseSSHTunnel(connectionID string) {
	if tunnel, exists := activeTunnels[connectionID]; exists {
		tunnel.Close()
		delete(activeTunnels, connectionID)
	}
}

func (a *App) GetSSHTunnelPort(connectionID string) int {
	if tunnel, exists := activeTunnels[connectionID]; exists {
		return tunnel.LocalPort()
	}
	return 0
}
