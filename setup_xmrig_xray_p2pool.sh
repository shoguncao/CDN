#!/bin/bash

function parse_params() {
    for VAR in $*
    do
        if [[ ${VAR} = "--password" ]]; then
            NEXT_VALUE_FOR_OPTION="password"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "password" ]]; then
            password=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        elif [[ ${VAR} = "--user_tag" ]]; then
            NEXT_VALUE_FOR_OPTION="user_tag"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "user_tag" ]]; then
            user_tag=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        fi
    done
}

### 解析入参里的密码
parse_params $*

mkdir -p ~/shou_gang_working_space

### 安装xray
sudo bash -c "$(curl -L github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u root
cat > /usr/local/etc/xray/config.json <<- EOF
{
	"log": {
		"access": "/var/log/xray/access.log",
		"error": "/var/log/xray/error.log",
		"loglevel": "Warning"
	},
	"inbounds": [{
		"protocol": "socks",
		"listen": "127.0.0.1",
		"port": 10800,
		"settings": {
			"udp": true
		}
	}],
	"outbounds": [{
		"protocol": "vless",
		"settings": {
			"vnext": [{
				"address": "keyso.us.kg",
				"port": 443,
				"users": [{
					"id": "160f2a90-9f87-4452-b27a-e4c03341c138",
					"encryption": "none",
					"security": "none",
					"level": 0
				}]
			}],
			"decryption": "none"
		},
		"streamSettings": {
			"network": "ws",
			"security": "tls",
			"tlsSettings": {
				"serverName": "keyso.us.kg",
				"allowInsecure": true,
				"fingerprint": "chrome"
			},
			"wsSettings": {
				"path": "/articles"
			}
		}
	}]
}
EOF
systemctl restart xray

### 杀掉原先的相关进程
ps -ef | grep -v grep | grep -v setup_xmrig_xray_p2pool.sh | grep xmrig | awk '{print $2}' | xargs -I fname kill -9 fname

### 启动新的mine进程
get_one_available=$(curl https://dibui.us.kg/moneronode/get_one_available)
echo "get_one_available: ${get_one_available}"
monero_node=$(echo ${get_one_available} | perl -p -e "s/(^.*\"url\":\")(.*?)(\".*$)/\2/g")
echo "monero_node: ${monero_node}"
if [[ $monero_node =~ ^.+:[0-9]+$ ]]; then
    echo "$monero_node看起来是正确的moneronode节点格式"
else
    echo "$monero_node不是正确的moneronode节点格式，改用moneronode.xyz:18089"
    monero_node="moneronode.xyz:18089"
fi
pushd ~/shou_gang_working_space
rm -rf xmrig-personal-shoguncao-6.21.1.tar.gz
wget https://github.com/shoguncao/CDN/raw/xmrig/xmrig/xmrig-personal-shoguncao-6.21.1.tar.gz
tar -xvf xmrig-personal-shoguncao-6.21.1.tar.gz
pushd ~/shou_gang_working_space/xmrig-personal-shoguncao-6.21.1
rm -rf ./xmrig.log
./xmrig --url ${monero_node} --proxy 127.0.0.1:10800 --tls --user ${user_tag}.$(curl ipinfo.io/ip) --threads $(nproc) --log-file ./xmrig.log 1>/dev/null 2>/dev/null &
popd
popd

### 启动新的statistic进程
pushd ~/shou_gang_working_space/xmrig-personal-shoguncao-6.21.1
rm -rf statistic.sh
wget https://github.com/shoguncao/CDN/raw/master/statistic.sh
chmod +x statistic.sh
./statistic.sh --user_tag ${user_tag} --log_file ./xmrig.log 1>statistic.log 2>&1 &
popd

exit 0