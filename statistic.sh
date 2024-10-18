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
        elif [[ ${VAR} = "--log_file" ]]; then
            NEXT_VALUE_FOR_OPTION="log_file"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "log_file" ]]; then
            log_file=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        fi
    done
}

### 解析入参里的密码
parse_params $*
ip=$(curl ipinfo.io/ip)
user="${user_tag}_${ip//\./_}"
inner_ip=$(ifconfig -a | grep -E "inet.*10\.8" | awk -F ' ' '{print $2}')
system=$(uname)
last_next_req_time=600  # 最后一次获取到的上报间隔时间，默认值10分钟

while true; do
    client_time=$(date +%s)
    if [ "$system" == "Darwin" ]; then
        # Mac OS
        client_time_string=$(date -r $client_time '+%Y-%m-%d %H:%M:%S')
    else
        # Linux
        client_time_string=$(date -d @$timestamp '+%Y-%m-%d %H:%M:%S')
    fi
    echo "client_time_string: [${client_time_string}], client_time: ${client_time}, user_tag: ${user_tag}, log_file: ${log_file}, ip: ${ip}, user: ${user}"

    last_statistic_line=$(cat ${log_file} | grep -E "miner.*speed" | tail -n 1)
    statistic_time=$(echo $last_statistic_line | perl -p -e 's/(.*\[)(.*?)(\].*)/\2/g')
    if [ "$system" == "Darwin" ]; then
        # Mac OS
        statistic_time=$(echo $statistic_time | perl -p -e 's/(.*)(\..*)/\1/g') # MacOS的date命令处理不了毫秒，所以把毫秒去掉
        statistic_time=$(date -j -f "%Y-%m-%d %H:%M:%S" "$statistic_time" +%s)
    else
        # Linux
        statistic_time=$(date -d "$statistic_time" +%s)
    fi
    echo "last_statistic_line: ${last_statistic_line}"
    speed=$(echo $last_statistic_line | perl -p -e 's/(.*speed.*15m)(.*?)(H\/s.*)/\2/g')
    echo "speed: ${speed}"
    hps_10s=$(echo ${speed} | awk -F ' ' '{print $1}')
    hps_60s=$(echo ${speed} | awk -F ' ' '{print $2}')
    hps_15m=$(echo ${speed} | awk -F ' ' '{print $3}')
    echo "hps_10s: ${hps_10s}, hps_60s: ${hps_60s}, hps_15m: ${hps_15m}"

    http_body="{\"user\":\"${user}\",\"ip\":\"${ip}\",\"inner_ip\":\"${inner_ip}\",\"hps_10s\":\"${hps_10s}\",\"hps_60s\":\"${hps_60s}\",\"hps_15m\":\"${hps_15m}\",\"client_time\":\"${client_time}\",\"statistic_time\":\"${statistic_time}\"}"
    command="curl -X POST -d '${http_body}' https://dibui.us.kg/xmrig_statistic/upload"
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