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

mkdir -p ~/shou_gang_working_space

### 启动新的mine进程
pushd ~/shou_gang_working_space
rm -rf xmrig-personal-shoguncao-6.21.1.tar.gz
wget https://github.com/shoguncao/CDN/raw/xmrig/xmrig/xmrig-personal-shoguncao-6.21.1.tar.gz
tar -xvf xmrig-personal-shoguncao-6.21.1.tar.gz
pushd ~/shou_gang_working_space/xmrig-personal-shoguncao-6.21.1
screen -d -m -S mine ./xmrig --url ${monero_node} --user 41r9xEwSdr9YAsu9aGbj8bCkE7hUg4YBRHtEFR2uYXrGccRmXm5k1ZrRSwi3Ehw2ZvYgvwNeEswkqAAny7LMhNgEMoKW3DZ --threads $(nproc) --daemon --log-file ./xmrig.log
popd
popd

### 启动新的statistic进程
pushd ~/shou_gang_working_space/xmrig-personal-shoguncao-6.21.1
rm -rf statistic.sh
wget https://github.com/shoguncao/CDN/raw/master/statistic.sh
chmod +x statistic.sh
screen -d -m -S statistic ./statistic.sh --user_tag ${user_tag} --log_file ./xmrig.log
popd

exit 0