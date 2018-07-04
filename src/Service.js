export default class Service {
    constructor(props) {
        const headers = new Headers();
        headers.append('Accept', 'application/json');
        headers.append('Content-Type', 'application/json');
        headers.append('X-Requested-With', 'XMLHttpRequest');
        this.state = {
            restURL: '/axelor-erp/ws/rest/',
            actionURL: '/axelor-erp/ws/action/',
            // restURL: '../../ws/rest/',
            // actionURL: '../../ws/action/',
        }
        this.headers = headers;
    }

    fetch(url, options) {
        return fetch(url, options);
    }

    request(url, config = {}, data = {}) {
        const options = Object.assign({
            method: 'POST',
            credentials: 'include',
            headers: this.headers,
            mode: 'cors',
            body: JSON.stringify(data),
        }, config);
        if (config.method === 'GET') {
            delete options.body;
        }
        return this.fetch(url, options);
    }

    post(url, data) {
        const config = {
            method: 'POST',
        };
        return this.request(url, config, data);
    }

    put(url, data) {
        const config = {
            method: 'PUT',
        };
        return this.request(url, config, data);
    }

    //insert data
    add(entity, record) {
        const data = {
            data: record,
        }
        const url = `${this.state.restURL}${entity}`;
        return this.put(url, data);
    }

    //fetch data
    getData(entity, options) {
        const data = {
            limit: 40,
            offset: 0,
            ...options
        };
        const url = `${this.state.restURL}${entity}/search`;
        return this.post(url, data);
    }

    //update
    update(entity, record, id) {
        const data = {
            data: record,
        }
        const url = `${this.state.restURL}${entity}/${id}`;
        return this.post(url, data);
    }

    //delete
    delete(entity, id) {
        const config = {
            method: 'DELETE',
        }
        const url = `${this.state.restURL}${entity}/${id}`;
        return this.request(url, config);
    }

    //fetch single data
    getId(entity, id) {
        const url = `${this.state.restURL}${entity}/${id}/fetch`;
        return this.post(url, {});
    }

     getAction(model, action, id) {
        const data = {
            model: model,
            action: action,
            prodProcess: { id: id }
        }
        const url = `${this.state.actionURL}`;
        return this.request(url, {}, data)
    }
}