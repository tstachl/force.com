/**
 * Versioning seems to be important and we also need to create a session variable
 */
Force = {
	version: '0.1.0',
	versionDetail: {
		major: 0,
		minor: 1,
		patch: 0
	},
	session: null,
	ready: Ext.onReady,
	formatDate: Ext.util.Format.date,
	serverDateFormat: 'Y-m-d\\TH:i:s.uO',
	setSession: function(n) {
		this.session = n;
		Ext.Ajax.defaultHeaders = {
			'Authorization': 'OAuth ' + n,
			'Content-Type': 'application/json'
		};
		Ext.Ajax.disableCaching = false;
	}
};

// Creating the namespaces for Force.data and Force.grid
Ext.ns('Force.data', 'Force.grid', 'Force.form');

// Small changes on the Ext.data.JsonWriter
Force.data.Writer = Ext.extend(Ext.data.JsonWriter, {
	render : function(params, baseParams, data) {
		// No need for having the id in the jsonData for the REST API
		if (typeof data.Id != 'undefined')
			delete data.Id;
		// defer encoding for some other layer, probably in {@link Ext.Ajax#request}.  Place everything into "jsonData" key.
		params.jsonData = data;
	}
});

// Rewrote the doRequest function in an older version (not needed anymore)
// as Force.data.Proxy is still in use we leave the extend statement
Force.data.Proxy = Ext.extend(Ext.data.HttpProxy, {});

// The Force.data.Store is the core component. It establishs the connection
// to the RESTful API.
Force.data.Store = Ext.extend(Ext.data.JsonStore, {
	showAlert: true,
	colModel: null,
	clause: null,
	constructor: function(config) {
		if (Ext.isDefined(config.colModel)) {
			config.fields = [];
			Ext.each(config.colModel.columns, function(item, index, all) {
				config.fields.push(item.dataIndex);
			});
		}
		
		if (Ext.isDefined(config.table)) {
			config.object = config.table;
		}

		Ext.apply(config, {
			restful: true,
			root: 'records',
			idProperty: 'Id',
			successProperty: 'done',
			totalProperty: 'totalSize',
			writer: new Force.data.Writer(),
			proxy: new Force.data.Proxy({
				method: 'GET',
				url: '/services/data/v20.0/query.json',
				api: {
					create: {
						url: '/services/data/v20.0/sobjects/' + config.object + '.json',
						method: 'PATCH'
					},
					update: {
						url: '/services/data/v20.0/sobjects/' + config.object + '.json',
						method: 'PATCH'
					},
					destroy: {
						url: '/services/data/v20.0/sobjects/' + config.object + '.json',
						method: 'DELETE'
					}
				}
			})
		});

		Force.data.Store.superclass.constructor.call(this, config);

		this.addListener('exception', this.exceptionThrown, this);
	},
	load: function(options) {
		options = Ext.apply({}, options);
		this.storeOptions(options);
		options.params = Ext.apply({}, options.params);
		var sortQuery = '';
		if(this.sortInfo && this.remoteSort) {
			sortQuery = ' ORDER BY ' + this.sortInfo.field;
			sortQuery += ' ' + this.sortInfo.direction;
		}
		Ext.apply(options.params, {
			q: this.getQuery() + sortQuery
		});
		try {
			return this.execute('read', null, options); // <-- null represents rs.  No rs for load actions.
		} catch(e) {
			this.handleException(e);
			return false;
		}
	},
	getQuery: function() {
		var q = 'SELECT ';
		Ext.each(this.fields.keys, function(item, index, all) {
			q += item + ((index == all.length-1) ? ' ' : ', ');
		});
		q += 'FROM ' + this.object;
		return (this.clause) ? q + ' ' + this.clause : q;
	},
	execute : function(action, rs, options, /* private */ batch) {
		// blow up if action not Ext.data.CREATE, READ, UPDATE, DESTROY
		if (!Ext.data.Api.isAction(action)) {
			throw new Ext.data.Api.Error('execute', action);
		}
		// make sure options has a fresh, new params hash
		options = Ext.applyIf(options|| {}, {
			params: {}
		});
		if(batch !== undefined) {
			this.addToBatch(batch);
		}
		// have to separate before-events since load has a different signature than create,destroy and save events since load does not
		// include the rs (record resultset) parameter.  Capture return values from the beforeaction into doRequest flag.
		var doRequest = true;
		if (action === 'read') {
			doRequest = this.fireEvent('beforeload', this, options);
			Ext.applyIf(options.params, this.baseParams);
		} else {
			// if Writer is configured as listful, force single-record rs to be [{}] instead of {}
			// TODO Move listful rendering into DataWriter where the @cfg is defined.  Should be easy now.
			if (this.writer.listful === true && this.restful !== true) {
				rs = (Ext.isArray(rs)) ? rs : [rs];
			}
			// if rs has just a single record, shift it off so that Writer writes data as '{}' rather than '[{}]'
			else if (Ext.isArray(rs) && rs.length == 1) {
				rs = rs.shift();
			}
			// Write the action to options.params
			if ((doRequest = this.fireEvent('beforewrite', this, action, rs, options)) !== false) {
				this.writer.apply(options.params, this.baseParams, action, rs);
			}
		}
		if (doRequest !== false) {
			// Send request to proxy.
			if (this.writer && this.proxy.url && !this.proxy.restful && !Ext.data.Api.hasUniqueUrl(this.proxy, action)) {
				options.params.xaction = action;    // <-- really old, probaby unecessary.
			}
			// Note:  Up until this point we've been dealing with 'action' as a key from Ext.data.Api.actions.
			// We'll flip it now and send the value into DataProxy#request, since it's the value which maps to
			// the user's configured DataProxy#api
			// TODO Refactor all Proxies to accept an instance of Ext.data.Request (not yet defined) instead of this looooooong list
			// of params.  This method is an artifact from Ext2.
			this.proxy.request(Ext.data.Api.actions[action], rs, options.params, this.reader, this.createCallback(action, rs, batch), this, options);
		}
		return doRequest;
	},
	exceptionThrown: function(pr, type, action, conn, resp) {
		if (this.showAlert) {
			var msgs = Ext.decode(resp.responseText);
			Ext.Msg.alert(resp.status + ' ' + resp.statusText, Ext.isDefined(msgs[0]) && Ext.isDefined(msgs[0].message) ? msgs[0].message : '');
		}
	},
	getColModel: function() {
		if (this.colModel) {
			return new Ext.grid.ColumnModel(this.colModel);
		}
		return null;
	}
});

Force.data.Describe = Ext.extend(Ext.util.MixedCollection, {
	showAlert: true,
	constructor: function(config) {
		if (Ext.isDefined(config.table)) {
			config.object = config.table;
		}
		
		Ext.apply(this, config, {
			autoLoad: false,
			url: '/services/data/v20.0/sobjects/' + config.object + '/describe.json'
		});
		
		Force.data.Describe.superclass.constructor.call(this, config);
		
		this.on({
			exception: this.exceptionThrown,
			load: this.loaded,
			scope: this
		});
		
		if (this.autoLoad) this.load();
	},
	load: function() {
		Ext.Ajax.request({
			url: this.url,
			callback: this.requestCallback,
			scope: this
		});
	},
	requestCallback: function(options, success, resp) {
		if (success) {
			this.fireEvent('load', this, resp, options);
		} else {
			this.fireEvent('exception', this, resp, options);
		}
	},
	loaded: function(desc, resp, options) {
		var json = Ext.decode(resp.responseText), value;
		for (var key in json) {
			if (key === 'fields' || key === 'recordTypeInfos') value = this.buildMixedCollection(json[key]);
			else if (key === 'childRelationships') value = this.buildRelationships(json[key]);
			else value = json[key]
			desc.add(key, value);
		}
		this.fireEvent('afterload', desc);
	},
	buildMixedCollection: function(fields) {
		var temp = new Ext.util.MixedCollection();
		Ext.each(fields, function(item) {
			temp.add(item.name, item);
		});
		return temp;
	},
	buildRelationships: function(rel) {
		var temp = new Ext.util.MixedCollection();
		Ext.each(rel, function(item) {
			temp.add(item.relationshipName || 'Parent', item);
		});
		return temp;
	},
	exceptionThrown: function(desc, resp, options) {
		if (this.showAlert) {
			var msgs = Ext.decode(resp.responseText);
			Ext.Msg.alert(resp.status + ' ' + resp.statusText, Ext.isDefined(msgs[0]) && Ext.isDefined(msgs[0].message) ? msgs[0].message : '');
		}
	}
});

// Add the createStore function to the standard GridPanel
Ext.override(Ext.grid.GridPanel, {
	constructor: function(config) {
		this.createStore(config);
		Ext.grid.GridPanel.superclass.constructor.call(this, config);
	},
	createStore: function(config) {
		console.log('Hello');
		if (!Ext.isDefined(config.store) && Ext.isDefined(config.colModel)
		&& Ext.isDefined(config.colModel.columns) && (Ext.isDefined(config.object) || Ext.isDefined(config.table))) {
			var fields = [];
			Ext.each(config.colModel.columns, function(item, index, all) {
				fields.push(item.dataIndex);
			});
			config.store = new Force.data.Store({
				autoDestroy: true,
				object: config.object || config.table,
				fields: fields
			});
			config.store.load();
			config.colModel = new Ext.grid.ColumnModel(config.colModel);
		}
	}
});