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

monero_node_list=("node.majesticbank.is:18089" "node.monerodevs.org:18089" "monero-g2.hexhex.online:18081" "xmr.support:18081" "node1.xmr-tw.org:18081" "xmr.tcpcat.net:18089" "xmr.bikini.cafe:18081" "monero.sphinxlogic.com:18089" "xmr-de-1.boldsuck.org:18081" "moneronode1.relaycrun.ch:18081" "xmr.ducks.party:18081" "monero.earth:18081" "xmr.vectorlink.io:18089" "node.xmr.rocks:18089" "rucknium.me:18081" "monerodice.pro:18089" "monero-rpc.cheems.de.box.skhron.com.ua:18089" "owl.lc:18089" "147.45.196.232:18089" "185.218.124.120:18089" "38.105.209.54:18089" "104.153.209.162:18081" "46.32.46.171:18081" "node.majesticbank.at:18089" "68.251.60.69:18089" "95.217.178.183:18089" "opennode.xmr-tw.org:18089" "xm.rip:18081" "144.91.121.7:18089" "l4nk0r.dev:18089" "xmr-pruned.p2pool.uk:18089" "xmr.monopolymoney.eu:18089" "monero.dyni.net:18081" "anstee.dev:18081" "xmr.mailia.be:18088" "hantaan.fullm00n.de:18089" "82.147.85.13:18089" "node3-us.monero.love:18081" "68.118.241.70:18089")
### 垃圾节点("125.253.96.180:18089" "nodex.monerujo.io:18081" "node.yeetin.me:18089" "edge7.servebeer.com:18089" "pinodexmr.hopto.org:18081" "server.cnet.cz:18081")
random_index=$((RANDOM % ${#monero_node_list[@]}))
monero_node=${monero_node_list[$random_index]}

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