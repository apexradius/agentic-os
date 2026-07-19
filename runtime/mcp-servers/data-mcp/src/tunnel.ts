import * as fs from 'fs';
import * as net from 'net';
import { Client as SshClient } from 'ssh2';

export interface TunnelConfig {
  sshHost: string;
  sshPort: number;
  sshUser: string;
  sshKey?: string; // path to private key file
  sshPassword?: string;
  pgHost: string;
  pgPort: number;
}

export interface Tunnel {
  localPort: number;
  close(): void;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        srv.close();
        reject(new Error('Could not get free port'));
        return;
      }
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function openTunnel(config: TunnelConfig): Promise<Tunnel> {
  const localPort = await getFreePort();

  return new Promise((resolve, reject) => {
    const ssh = new SshClient();
    let ready = false;

    const timeout = setTimeout(() => {
      if (!ready) {
        ssh.end();
        reject(new Error(`SSH tunnel to ${config.sshHost}:${config.sshPort} timed out after 10s`));
      }
    }, 10_000);

    const tcpServer = net.createServer((socket) => {
      ssh.forwardOut('127.0.0.1', localPort, config.pgHost, config.pgPort, (err, stream) => {
        if (err) {
          socket.destroy();
          return;
        }
        socket.pipe(stream).pipe(socket);
        stream.on('error', () => socket.destroy());
        socket.on('error', () => stream.destroy());
        stream.on('close', () => socket.destroy());
        socket.on('close', () => stream.destroy());
      });
    });

    ssh.on('ready', () => {
      ready = true;
      clearTimeout(timeout);
      tcpServer.listen(localPort, '127.0.0.1', () => {
        resolve({
          localPort,
          close() {
            tcpServer.close();
            ssh.end();
          },
        });
      });
      tcpServer.on('error', (err) => {
        ssh.end();
        reject(err);
      });
    });

    ssh.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`SSH connection failed: ${err.message}`));
    });

    const connectConfig: Parameters<SshClient['connect']>[0] = {
      host: config.sshHost,
      port: config.sshPort,
      username: config.sshUser,
    };

    if (config.sshKey && fs.existsSync(config.sshKey)) {
      connectConfig.privateKey = fs.readFileSync(config.sshKey);
    } else if (config.sshPassword) {
      connectConfig.password = config.sshPassword;
    } else if (process.env['SSH_AUTH_SOCK']) {
      connectConfig.agent = process.env['SSH_AUTH_SOCK'];
    }

    ssh.connect(connectConfig);
  });
}
