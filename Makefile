.PHONY: all test clean static
node-dev:
	node-dev app.js
supervisor:
	supervisor -n error -i 'app/public/,app/views/,config/tasks/' app.js
push:
	git push origin master
pm2:
	NODE_ENV=openshift pm2 start app.js 
initHeroku:
	heroku create
pushHeroku:
	gsed -i 's/"start": .*/"start": "NODE_ENV=heroku pm2 start .\/app.js --no-daemon",/g' ./package.json
	git add -A && git commit -m "heroku auto" && git push heroku master && heroku logs --tail
