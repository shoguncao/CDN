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

export LC_ALL=C
export LANGUAGE=en_US.UTF-8
mkdir -p /root/shou_gang_working_space

### 解析入参里的密码
parse_params $*
ip=$(curl ipinfo.io/ip)
system=$(uname)
last_next_req_time=600  # 最后一次获取到的上报间隔时间，默认值10分钟

### 安装expect
apt-get update
apt-get install -y expect

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
systemctl restart sshd

vps_create_time=$(stat /root/shou_gang_working_space | grep Birth | perl -p -e 's/(.*)([0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})(.*)/\2/g')
vps_create_unixtime=$(date -d "$vps_create_time" +%s)
echo "vps_create_time: ${vps_create_time}, vps_create_unixtime: ${vps_create_unixtime}"

while true; do
    if [[ ! "$ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
        ip=$(curl ipinfo.io/ip)
    fi
    client_time=$(date +%s)
    if [ "$system" == "Darwin" ]; then
        # Mac OS
        client_time_string=$(date -r $client_time '+%Y-%m-%d %H:%M:%S')
    else
        # Linux
        client_time_string=$(date -d @$client_time '+%Y-%m-%d %H:%M:%S')
    fi
    echo "client_time_string: [${client_time_string}], client_time: ${client_time}, user_tag: ${user_tag}, ip: ${ip}"

    http_body="{\"user_tag\":\"$user_tag\",\"ip\":\"${ip}\",\"vps_create_time\":\"${vps_create_unixtime}\",\"client_time\":\"${client_time}\"}"
    command="curl -X POST -d '${http_body}' https://dibui.us.kg/vps/upload"
    echo "curl command: ${command}"
    rsp_body=$(eval ${command})

    echo "rsp_body: ${rsp_body}"
    next_req_time=$(echo ${rsp_body} | perl -p -e "s/(.*)(\"next_req_time\")(.*?\")(.*?)(\".*)/\4/g")
    if [[ "$next_req_time" =~ ^[0-9]+$ ]] && [ "$next_req_time" -ge 0 ]; then
        # next_req_time可以转换为整数，且>=0
        echo "next_req_time: $next_req_time"
    else
        # next_req_time不可以转换为整数，获取不到，直接用上一次的间隔
        next_req_time=${last_next_req_time}
        echo "next_req_time: $next_req_time"
    fi
    last_next_req_time=${next_req_time}
    echo "Sleeping for $next_req_time seconds..."
    sleep $next_req_time
done

exit 0