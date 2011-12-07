Ext.ns("Force.cmp");
Force.cmp.GanttEvent = Ext.extend(Ext.BoxComponent, {
	startHour : null,
	startMinute : null,
	endHour : null,
	endMinute : null,
	showEventHover : !0,
	autoEl : {
		tag : "div",
		cls : "force-gantt-event"
	},
	hover : null,
	initComponent : function() {
		var c = Date.parseDate(this.rec.get("StartDateTime"), Force.serverDateFormat);
		this.startHour = c.getHours();
		this.startMinute = c.getMinutes();
		var d = Date.parseDate(this.rec.get("EndDateTime"), Force.serverDateFormat);
		this.endHour = d.getHours();
		this.endMinute = d.getMinutes();
		this.x = this.x + (c.getHours() - this.ownerCt.startTime.getHours()) * this.cellWidth + this.cellWidth / 60 * c.getMinutes();
		this.width = this.cellWidth / 60 * parseInt(this.rec.get("DurationInMinutes"));
		this.on("afterrender", this.addHover, this)
	},
	addHover : function() {
		if(this.showEventHover)
			this.getEl().on({
				mouseenter : function(c) {c.stopPropagation();
					var d = Ext.get("HoverElement_" + this.rec.get("Id"));
					d || (Ext.DomHelper.append(Ext.getBody().select("td.oRight").first(), {
						id : "HoverElement_" + this.rec.get("Id"),
						tag : "div",
						cls : "hoverDetail eventBusy",
						children : [{
							tag : "div",
							cls : "hoverOuter",
							children : [{
								tag : "div",
								cls : "hoverInner",
								children : [{
									tag : "div",
									cls : "hoverContent",
									id : "HoverElement_" + this.rec.get("Id") + "_Content"
								}]
							}]
						}]
					}), d = Ext.get("HoverElement_" + this.rec.get("Id")), Ext.Ajax.request({
						url : "/ui/core/activity/EventHoverPage",
						success : function(c) {d.select(".hoverContent").first().insertHtml("afterBegin", c.responseText)
						},
						params : {
							id : this.rec.get("Id"),
							Subject : this.rec.get("Subject"),
							Location : this.rec.get("Location"),
							Start : this.rec.get("StartDateTime"),
							End : this.rec.get("EndDateTime")
						},
						method : "GET"
					}));
					d.setXY(Ext.EventObject.getXY()).setPositioning({"z-index":20}).show()
				},
				mouseleave : function() {
					var c = Ext.get("HoverElement_"+this.rec.get("Id")).setPositioning({
						"z-index" : 15
					});
					c.timer = (new Ext.util.DelayedTask(function(){c.setXY([-1E3,-1E3]).hide()})).delay(300)
				},
				click : function() {
					window.location.href = "/" + this.rec.get("Id")
				},
				scope : this
			})
	}
});
Force.cmp.GanttPanel = Ext.extend(Ext.grid.GridPanel, {
	id : "Test",
	startTime : null,
	endTime : null,
	date : null,
	timeFormat : "h:i a",
	dateFormat : "d/m/Y",
	stepMinutes : 15,
	showUserHover : !0,
	showEventHover : !0,
	events : [],
	viewConfig : {
		forceFit : !0
	},
	nameColumnWidth: 15,
	enableColumnMove : !1,
	trackMouseOver : !1,
	loadMask: !0,
	initComponent : function() {
		this.describe = new Force.data.Describe({
			object: this.store.object,
			autoLoad: true,
			listeners: {
				afterload: this.descriptionLoaded,
				scope: this
			}
		});
		
		this.originalClause = this.store.clause;
		
		if(null === this.startTime)
			this.startTime = new Date, this.startTime.setHours(8), this.startTime.setMinutes(0)
		if(null === this.endTime)
			this.endTime = new Date, this.endTime.setHours(19), this.endTime.setMinutes(0)
		if(null === this.date)
			this.date = new Date;
		this.initialColumns();
		
		this._cssId = Ext.id();
	    // The CSS needed to style the dialog.
	    var css = '.force-gantt-event{background:#D9EDF9;position:absolute;overflow:hidden;padding: 3px 3px 3px 5px;white-space:nowrap;}'
	        + '.userProfileHoverPageBlock{border-top:none!important;}.x-grid3-cell-selected{background-color:#D9EDF9!important;border-color:#DDDDDD;}'
	        + '.x-menu li{margin:0;}.x-btn{padding:0;}.x-date-mp-btns button{background-image:none;}';
	    Ext.util.CSS.createStyleSheet(css, this._cssId);
		
		Force.cmp.GanttPanel.superclass.initComponent.call(this);
		
		this.addEvents({
			cellover : !0,
			cellout : !0,
			newevent : !0
		});
	},
	setStartTime: function(s) {
		if (typeof s == 'string')
			this.startTime = Date.parseDate(s, this.timeFormat);
		else
			this.startTime = s;
	},
	setEndTime: function(s) {
		if (typeof s == 'string')
			this.endTime = Date.parseDate(s, this.timeFormat);
		else
			this.endTime = s;
	},
	setDate: function(s) {
		if (typeof s == 'string')
			this.date = Date.parseDate(s, this.dateFormat);
		else
			this.date = s;
	},
	setSpecialty: function(s) {
		this.specialty = s;
	},
	onRender : function() {Force.cmp.GanttPanel.superclass.onRender.apply(this, arguments);
		this.getGridEl();
		this.el.addClass("force-gantt-panel");
		this.on({
			scope : this,
			cellclick : this.onCellClick,
			viewready : this.onViewReady,
			mouseover : this.onMouseOver,
			mouseout : this.onMouseOut,
			cellover : this.onCellOver,
			cellout : this.onCellOut,
			bodyresize: this.refreshEvents,
			sortchange: this.refreshEvents
		});
		this.store.on({
			scope : this,
			load : this.refreshEventStore
		});
		this.colModel.on({
			scope: this,
			configchange: this.refreshEventStore
		});
	},
    afterRender : function(){
        Ext.grid.GridPanel.superclass.afterRender.call(this);
        this.showMask();
		this.createToolbar();
    },
    initEvents : function(){
        Ext.grid.GridPanel.superclass.initEvents.call(this);

        if (this.loadMask) {
            this.loadMask = new Ext.LoadMask(this.bwrap,{msg:'Please wait ...'});
        }
    },
	onCellClick : function(c, d, e, a) {
		if(e !== 0) {a.stopPropagation();
			var k = c.getColumnModel().getDataIndex(e), e = c.getView().getCell(d, e), a = a.getXY()[0] - Ext.get(e).getXY()[0], a = parseInt(60 / Ext.get(e).getComputedWidth() * a), e = c.date.clone();
			e.setHours(k, a, 0, 0);
			this.fireEvent("newevent", e.format(Force.serverDateFormat), c.getStore().getAt(d))
		}
	},
	onViewReady : function() {
	},
	onMouseOver : function(c, d) {
		var e = this.getView(), a = e.findCellIndex(d), e = e.findRowIndex(d);
		rec = this.getStore().getAt(e); a !== !1 && e !== !1 && rec !== !1 && this.fireEvent("cellover", a, e, rec, c)
	},
	onMouseOut : function(c, d) {
		var e = this.getView(), a = e.findCellIndex(d), e = e.findRowIndex(d);
		rec = this.getStore().getAt(e);
		a !== !1 && e !== !1 && rec !== !1 && this.fireEvent("cellout", a, e, rec, c)
	},
	onCellOver : function(c, d, e, a) {
		if(this.showUserHover && c === 0) {a.stopPropagation();
			var k = Ext.get("HoverElement_" + e.get("Id"));
			k || (Ext.DomHelper.append(Ext.getBody().select("td.oRight").first(), {
				id : "HoverElement_" + e.get("Id"),
				tag : "div",
				cls : "individualPalette lookupHoverDetail lookupHoverDetailOverridable",
				children : [{
					tag : "div",
					cls : "userProfileHoverUserBlock setupBlock topLeft",
					id : "HoverElement_" + e.get("Id") + "_Content"
				}]
			}), k = Ext.get("HoverElement_" + e.get("Id")), Ext.Ajax.request({
				url : "/" + e.get("Id") + "/m",
				success : function(a) {k.select(".userProfileHoverUserBlock").first().insertHtml("afterBegin", a.responseText)
				},
				params : {
					isAjaxRequest : 1
				},
				method : "GET"
			}));
			k.setXY([Ext.EventObject.getPageX(),Ext.EventObject.getPageY()-10]).setPositioning({"z-index":20}).show()
		}
		
		if (c !== 0) {
			if(this.currentCell){
				this.currentCell.removeClass('x-grid3-cell-selected');
			}
			this.currentCell = Ext.get(this.getView().getCell(d, c));
			this.currentCell.addClass('x-grid3-cell-selected');
		}
	},
	onCellOut : function(c, d, e) {
		if(this.showUserHover && c === 0) {
			var a = Ext.get("HoverElement_"+e.get("Id")).setPositioning({
				"z-index" : 15
			});
			a.timer = (new Ext.util.DelayedTask(function(){a.setXY([-1E3,-1E3]).hide()})).delay(300)
		}
		
		if(this.currentCell){
			this.currentCell.removeClass('x-grid3-cell-selected');
		}
		delete this.currentCell;
	},
	refreshEventStore : function() {
		if (this.store.getCount() === 0) return false;
		this.showMask();
		var c = "WHERE ActivityDate=" + Force.formatDate(this.date, "Y-m-d") + " AND (";
		this.store.each(function(d) {
			c += "WhatId='" + d.get("Id") + "' OR "
		});
		c = c.substr(0, c.length - 4) + ") AND IsPrivate=false AND IsDeleted=false";
		this.eventStore = new Force.data.Store({
			table : "event",
			fields : ["Id", "IsAllDayEvent", "OwnerId", "WhatId", "EndDateTime", "Location", "StartDateTime", "Subject", "DurationInMinutes"],
			clause : c
		});
		new Ext.LoadMask(this.getEl(), {msg:'Please wait ...',store:this.eventStore});
		this.eventStore.on("load", this.refreshEvents, this);
		this.eventStore.load()
	},
	refreshEvents : function() {
		Ext.each(this.events, function(c) {c.destroy()});
		if (typeof this.eventStore != 'undefined')
			this.eventStore.each(function(c) {this.createEvent(c)}, this);
		this.hideMask();
	},
	createEvent : function(c) {
		if(Date.parseDate(c.get("StartDateTime"), Force.serverDateFormat) < this.endTime) {
			var d = this.store.indexOfId(c.get("WhatId")),
			    e = Ext.get(this.getView().getRow(d));
			console.log(d, e, c.get("WhatId"));
			var a = e.getHeight(),
			    e = "-" + e.getHeight() + "px",
			    k = Ext.get(this.getView().getCell(d,0)).getComputedWidth(),
			    m = Ext.get(this.getView().getCell(d,1)).getComputedWidth();
			var e = new Force.cmp.GanttEvent({height:a,width:10,style:{marginTop:e,borderLeft:"4px solid #6699CC"},x:k,cellWidth:m,rec:c,ownerCt:this,showEventHover:this.showEventHover});
			this.events.push(e);
			e.render(this.getView().getRow(d))
		}
	},
	initialColumns: function() {
		this.colModel = new Ext.grid.ColumnModel({
			defaults : {
				sortable : !1,
				hideable : !1,
				resizable : !1,
				menuDisabled : !0,
				dragable : !1
			},
			columns : this.createColumns()
		})
	},
	refreshColumns : function() {
		this.colModel.setConfig(this.createColumns());
	},
	createColumns : function() {
		var c = [];
		c.push({
			header : "Name",
			dataIndex : "Name",
			sortable : !0,
			width : this.nameColumnWidth,
			resizable : !1
		});
		
		for(var d = 0; d < this.endTime.getHours() - this.startTime.getHours(); d++) {
			var e = new Date(2010, 1, 1, this.startTime.getHours() + d, 0, 0, 0);
			c.push({
				width: (100 - this.nameColumnWidth) / (this.endTime.getHours() - this.startTime.getHours()),
				header : Force.formatDate(e, this.timeFormat),
				dataIndex : e.getHours()
			})
		}
		return c;
	},
	descriptionLoaded: function(desc) {
		console.log(desc.key('fields').key('Specialities__pc').picklistValues);
		this.specialtyStore.loadData({specialty: desc.key('fields').key('Specialities__pc').picklistValues });
		console.log(this.specialtyStore);
	},
	userQueryClause: function() {
		var clause = this.originalClause;
		if (this.specialty) {
			clause += " AND Specialities__pc includes ('" + this.specialty + "')";
		}
		this.store.clause = clause;
		this.store.load();
	},
	createToolbar: function() {
		this.specialtyStore = new Ext.data.JsonStore({
			idProperty: 'value',
			root: 'specialty',
			fields: ['active', 'defaultValue', 'label', 'validFor', 'value']
		});
		var specialty = new Ext.form.ComboBox({
			typeAhead: true,
			triggerAction: 'all',
			lazyRender: true,
			mode: 'local',
			emptyText: 'Specialty',
			store: this.specialtyStore,
			valueField: 'value',
			displayField: 'label',
			listeners: {
				scope: this,
				select: function(field, data) {
					this.setSpecialty(data);
					this.userQueryClause();
				}
			}
		});
		
		var date = new Ext.form.DateField({
			format: this.dateFormat,
			value: this.date,
			minValue: new Date,
			listeners: {
				scope: this,
				select: function(f, d) {
					this.setDate(d);
					this.refreshEventStore();
				}
			}
		});
		
		var startTime = new Ext.form.TimeField({
			width: 80,
			increment: 60,
			format: this.timeFormat,
			value: this.startTime,
			listeners: {
				scope: this,
				select: function(c, r, i) {
					this.setStartTime(r.get('field1'));
					this.refreshColumns();
					this.refreshEvents();
				}
			}
		});
		
		var endTime = new Ext.form.TimeField({
			width: 80,
			increment: 60,
			format: this.timeFormat,
			value: this.endTime,
			listeners: {
				scope: this,
				select: function(c, r, i) {
					this.setEndTime(r.get('field1'));
					this.refreshColumns();
					this.refreshEvents();
				}
			}
		});
		
		this.add(new Ext.Toolbar({
			items: [specialty, '->', date, startTime, endTime]
		}));
		this.doLayout();
	},
	showMask: function() {
		if (this.loadMask && typeof this.loadMask.show == 'function')
			this.loadMask.show();
	},
	hideMask: function() {
		if (this.loadMask && typeof this.loadMask.hide == 'function')
			this.loadMask.hide();
	}
});