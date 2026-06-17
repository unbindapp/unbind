# unbind-installer

After uninstalling k3s:

```
# Flush all iptables rules
sudo iptables -F
sudo iptables -t nat -F
sudo iptables -t mangle -F
sudo iptables -X
```
