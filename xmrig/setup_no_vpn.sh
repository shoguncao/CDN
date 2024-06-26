#!/bin/bash

function parse_params() {
    for VAR in $*
    do
        if [[ ${VAR} = "--password" ]]; then
            NEXT_VALUE_FOR_OPTION="password"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "password" ]]; then
            password=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        elif [[ ${VAR} = "--port" ]]; then
            NEXT_VALUE_FOR_OPTION="port"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "port" ]]; then
            port=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        elif [[ ${VAR} = "--threads" ]]; then
            NEXT_VALUE_FOR_OPTION="threads"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "threads" ]]; then
            threads=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        elif [[ ${VAR} = "--url" ]]; then
            NEXT_VALUE_FOR_OPTION="url"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "url" ]]; then
            url=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        elif [[ ${VAR} = "--user_tag" ]]; then
            NEXT_VALUE_FOR_OPTION="user_tag"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "user_tag" ]]; then
            user_tag=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        fi
    done

    if [ -z "${password}" ]; then
        my_log "password 不能为空，请添加--password参数"
        exit 1
    fi
    if [ -z "${port}" ]; then
        my_log "port 不能为空，请添加--port参数"
        exit 1
    fi
}

function my_log() {
    echo -e "\033[48;31m [setup_vps] $1 \033[0m"
}

### 安装expect
apt-get update
apt-get install -y expect

### 解析入参里的密码
parse_params $*
### 获取自己的公网ip地址
# self_ip=`host myip.opendns.com resolver1.opendns.com | awk '/address / {print $4}'`
self_ip=`curl -s ipinfo.io/ip`
my_log "self_ip: ${self_ip}"

### 设置可使用密码登录
sudo perl -pi -e "s/(PermitRootLogin|PasswordAuthentication) no/\1 yes/g" /etc/ssh/sshd_config
sudo perl -pi -e "s/#PermitRootLogin prohibit-password/PermitRootLogin yes/g" /etc/ssh/sshd_config
sudo perl -pi -e "s/UsePAM yes/UsePAM no/g" /etc/ssh/sshd_config
expect << EOF
set timeout 30
set password ${password}
spawn sudo passwd root
expect {
    "New password" {
        send "$password\r"
        exp_continue
    }
    "Retype new password" {
        send "$password\r"
    }
}
expect eof
EOF
systemctl restart ssh

### 创建shou_gang_working_space目录
mkdir -p /root/shou_gang_working_space
cd /root/shou_gang_working_space

### 拷贝xmrig配置过来
wget https://github.com/shoguncao/CDN/raw/xmrig/xmrig/xmrig-personal-shoguncao-6.21.1.tar.gz

### 解压xmrig
tar -xvf xmrig-personal-shoguncao-6.21.1.tar.gz

### 执行xmrig
cd xmrig-personal-shoguncao-6.21.1
user=`echo ${self_ip} | perl -p -e 's/\./_/g'`
user="${user_tag}_${user}"
screen -S mine ./xmrig --threads ${threads} --url ${url}:${port} --user ${user}
