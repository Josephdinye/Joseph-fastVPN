function FindProxyForURL(url, host) {
    var bypassList = ["whatismyipaddress.com"];
    host = host.toLowerCase();
    for (var i = 0; i < bypassList.length; i++) {
        var domain = bypassList[i];
        if (host === domain || host.substring(host.length - domain.length - 1) === "." + domain) {
            return "DIRECT";
        }
    }
    return "PROXY 127.0.0.1:10809; DIRECT";
}