Provide your own Telerising API BIN.
It will be intigrated.

BIN has to be exactly "src/telerising/api"


Check if valid config file: src/telerising/settings.json, else:

1. Set Password:
http://localhost:5000/api/signup_check
POST
Body: pw=xyz

2. Get Provider:
GET http://localhost:5000/static/json/providers-0149.json

3. Set Provider:
http://localhost:5000/api/login
POST
Body: id={provider shortcut}&no_auth=false&login=idk&pw=abc

4. Get Channel list:
http://localhost:5000/api/{provider}/file/channels.m3u?ffmpeg=true

5. Stream:
http://192.168.178.24:5000/api/{provider}/live/{channel_name}