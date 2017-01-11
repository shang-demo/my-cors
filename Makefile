.PHONY: all test clean static
node-dev:
	node-dev app.js
supervisor:
	supervisor -n error -i 'app/public/,app/views/,config/tasks/' app.js
push:
	git push origin master
pushProd:
	git push coding master:my-cors -f
