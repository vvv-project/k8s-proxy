const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

http.listen(port, function () {
    console.log(`listening on *:${port}`)
});

const k8s = require('@kubernetes/client-node');

const endpoint = '/api/v1/namespaces/default/pods';

const conf = new k8s.KubeConfig();
conf.loadFromCluster();

const k8sApi = conf.makeApiClient(k8s.CoreV1Api);
const w = new k8s.Watch(conf);

function watchK8s() {
    w.watch(
        endpoint,
        { 'labelSelector': 'deletable=yes' },
        (type, obj) => {
            console.log(`Event: ${type}`)
            switch (type) {
                case 'ADDED':
                    io.emit('addedPod', obj.metadata.name)
                    if(obj.kind === 'Pod' && obj.apiVersion === 'v1'){
                        io.emit('addedV1Pod', obj)
                    }
                    break
                case 'MODIFIED':
                    io.emit('modifiedPod', obj.metadata.name)
                    if(obj.kind === 'Pod' && obj.apiVersion === 'v1'){
                        io.emit('modifiedV1Pod', obj)
                    }                    
                    break
                case 'DELETED':
                    io.emit('deletedPod', obj.metadata.name)
                    if(obj.kind === 'Pod' && obj.apiVersion === 'v1'){
                        io.emit('deletedV1Pod', obj)
                    }
                    break
            }
        },
        err => {
            if (err) {
                console.error(err)
            }
            else {
                console.log('done')
            }
        }
    )
}

io.on('connect', function (socket) {
    console.log('A client connected');

    k8sApi.listNamespacedPod('default', null, null, null, null, 'deletable=yes')
        .then((res) => {
            console.log(res.body);
            socket.emit('getPods', res.body);
        });
});

io.on('getPodsRequest', function (socket) {
    console.log('A client requested getPods');

    k8sApi.listNamespacedPod('default', null, null, null, null, 'deletable=yes')
        .then((res) => {
            console.log(res.body);
            socket.emit('getPodsResponse', res.body);
        });
});

io.on('disconnect', function () {
    console.log('A client disconnected');
});

io.on('removePods', function(podList) {
    if (Array.isArray(podList)) {
        for (let i = 0; i < podList.length; i++) {
            console.log(`Removing Pod: ${podList[i]}`);
            k8sApi.deleteNamespacedPod(podList[i], 'default')
            .then((res) => {
                console.log(res.body);
            });
        }
    } else {
        console.log('removePods: Invalid value');
    }
});

watchK8s()
