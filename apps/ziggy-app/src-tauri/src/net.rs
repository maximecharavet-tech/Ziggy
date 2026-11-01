//! "Is Ziggy reachable?" before the app leaves its bundled launch page, so a child
//! with no network sees Ziggy's friendly offline page, never a browser error page.

use std::net::{TcpStream, ToSocketAddrs};
use std::sync::mpsc;
use std::time::Duration;

/// Opens (and closes) a TCP connection to the site's HTTPS port. DNS + TCP prove the
/// network is up without sending anything. A `false` is double-checked by the launch
/// page through the webview's own network stack (which also knows the system proxy).
pub fn site_reachable(host: &str, timeout: Duration) -> bool {
    let host = host.to_owned();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let reachable = (host.as_str(), 443)
            .to_socket_addrs()
            .map(|addrs| addrs.take(4).any(|addr| TcpStream::connect_timeout(&addr, timeout).is_ok()))
            .unwrap_or(false);
        let _ = tx.send(reachable);
    });
    // DNS lookups can't be given a timeout: stop waiting for them instead.
    rx.recv_timeout(timeout + Duration::from_millis(500)).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unknown_host_is_not_reachable() {
        assert!(!site_reachable("ziggy.invalid", Duration::from_millis(800)));
    }
}
