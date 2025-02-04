#!/bin/bash

function parse_params() {
    for VAR in $*
    do
        if [[ ${VAR} = "--password" ]]; then
            NEXT_VALUE_FOR_OPTION="password"
        elif [[ "${NEXT_VALUE_FOR_OPTION}" = "password" ]]; then
            password=${VAR}
            NEXT_VALUE_FOR_OPTION=""
        fi
    done
}

parse_params $*

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
