#!/bin/bash

apt-get install -y expect

rm -rf openvpn-install-use_ip_10.9.sh
wget https://github.com/shoguncao/CDN/raw/master/openvpn-install-use_ip_10.9.sh
chmod +x openvpn-install-use_ip_10.9.sh

expect << EOF
set timeout 3000
spawn bash ./openvpn-install-use_ip_10.9.sh
expect {
	"Public IPv4 address" {
		send "\r"
		exp_continue
	}
	"Which protocol should OpenVPN use" {
		send "\r"
		exp_continue
	}
	"What port should OpenVPN listen to" {
		send "5759\r"
		exp_continue
	}
	"Select a DNS server for the clients" {
		send "2\r"
		exp_continue
	}
	"Enter a name for the first client" {
		send "\r"
		exp_continue
	}
	"Press any key to continue" {
		send "\r"
	}
	eof
}
expect eof
EOF

perl -pi -e "s/resolv-retry infinite/route 43.135.118.188 255.255.255.255 net_gateway\nresolv-retry infinite/g" /root/client.ovpn;
echo "scp root@`curl -s ipinfo.io/ip`:/root/client.ovpn /Users/caoshougang/Downloads/ovpns/`curl -s ipinfo.io/ip`.ovpn";

