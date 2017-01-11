#!/usr/bin/env bash

projectName="cors";
nodeEnv="leancloud"

function pushCoding() {
	if test -n $1;
	then
	  nodeEnv=$1;
  fi

	if test -n $2;
	then
	  projectName=$2;
	fi

	gulp prod
	cp ./package.json ./production
	cp ./Dockerfile ./production
	gsed -i "s/\"start\": \".*/\"start\": \"NODE_ENV=${nodeEnv} pm2 start .\/app.js --no-daemon\",/g" ./production/package.json
	cd ./production 
	git add -A 
	git commit -m "auto"  || echo "nothing to commit"
	echo "git push -u production master:${projectName}"
	git push -u production master:${projectName} -f
}

pushCoding $*