#!/bin/bash

function parse_params() {
    for VAR in $*
    do
        if [[ ${VAR} = "--xray_port" ]]; then
            NEXT_VALUE_FOR_OPTION="xray_port"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "xray_port" ]]; then
            xray_port=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        fi
    done
    
    if [ -z "${xray_port}" ]; then
        echo "xray_port 不能为空，请添加--xray_port"
        exit 1
    fi
}

### 解析入参里的密码
parse_params $*

apt-get update

### 安装xray
sudo bash -c "$(curl -L github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u root
xray_config_file=$(cat /etc/systemd/system/xray.service | grep config.json | perl -p -e "s/(.*\-config\s)(.*)/\2/g")
cat > ${xray_config_file} <<- EOF
{
	"log": {
		"access": "/var/log/xray/access.log",
		"error": "/var/log/xray/error.log",
		"loglevel": "Warning"
	},
	"inbounds": [{
		"listen": "127.0.0.1",
		"port": ${xray_port},
		"protocol": "vless",
		"settings": {
			"clients": [{
				"id": "160f2a90-9f87-4452-b27a-e4c03341c138",
				"level": 0
			}],
			"decryption": "none",
			"fallbacks": []
		},
		"streamSettings": {
			"network": "ws",
			"wsSettings": {
				"path": "/articles"
			}
		}
	}],
	"outbounds": [{
		"protocol": "freedom",
		"settings": {

		}
	}]
}
EOF
systemctl restart xray

### 安装nginx
apt-get install -y nginx
nginx_v=$(nginx -V 2>&1)
nginx_config_file=$(echo ${nginx_v} | perl -p -e "s/(^.*--conf-path=)(.*?)( .*$)/\2/g")
### 生成证书
nginx_config_dir=$(echo ${nginx_config_file} | perl -p -e "s/(.*)(\/.*?$)/\1/g")
pushd ${nginx_config_dir}
sudo openssl ecparam -genkey -name prime256v1 -out ca.key
sudo openssl req -new -x509 -days 36500 -key ca.key -out ca.crt  -subj "/CN=bing.com"
popd
server_info=$(cat << EOF
	server {
		listen 443;
		ssl on;
		ssl_certificate  ca.crt;
		ssl_certificate_key ca.key;
		location \/articles {
			proxy_pass http:\/\/127.0.0.1:${xray_port};
			proxy_http_version 1.1;
			proxy_redirect off;
			proxy_set_header Upgrade \\\$http_upgrade;
			proxy_set_header Connection \"upgrade\";
			proxy_set_header Host \\\$host;
			proxy_set_header X-Real-IP \\\$remote_addr;
			proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
		}
	}
EOF
)
perl -pi -e "s/(include \/etc\/nginx\/sites-enabled\/\*;)/\1\n${server_info}/g" ${nginx_config_file}
systemctl restart nginx

### 输出连接语法
ip=$(curl ipinfo.io/ip)
echo "vless://160f2a90-9f87-4452-b27a-e4c03341c138@${ip}:443?flow=&security=tls&encryption=none&type=ws&host=${ip}&path=/articles&sni=&fp=chrome&pbk=&sid=&serviceName=/articles&headerType=&mode=&seed=#nginx-vless-${ip}"
