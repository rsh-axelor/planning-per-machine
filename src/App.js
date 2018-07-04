import React, { Component } from 'react';
import './App.css';
import Service from './Service';
import moment from 'moment';

export default class App extends Component {

  constructor() {
    super();
    this.state = {
      machineModel: [],
      machine: [],
      operationOrder: [],
      manufacturingOrder: [],
      prodProcessLine: [],
      machineWorkCenter: []
    }
    this.service = new Service();
  }

  componentDidMount() {
    const operationOrdersData = this.service.getData("com.axelor.apps.production.db.OperationOrder").then(res => res.json());
    const machineData = this.service.getData("com.axelor.apps.production.db.Machine").then(res => res.json());
    const manufacturingOrderData = this.service.getData("com.axelor.apps.production.db.ManufOrder").then(res => res.json());
    const prodProcessLineData = this.service.getData("com.axelor.apps.production.db.ProdProcessLine").then(res => res.json());
    const machineWorkCenterData = this.service.getData("com.axelor.apps.production.db.WorkCenter").then(res => res.json());


    Promise.all([machineData, operationOrdersData, manufacturingOrderData, prodProcessLineData, machineWorkCenterData])
      .then(([machineRes, operationOrdersRes, manufacturingOrderRes, prodProcessLineRes, machineWorkCenterRes]) => {
        this.setState({
          machineModel: machineRes.data,
          operationOrder: operationOrdersRes.data,
          manufacturingOrder: manufacturingOrderRes.data,
          prodProcessLine: prodProcessLineRes.data,
          machineWorkCenter: machineWorkCenterRes.data
        }, () => this.schedulerUpdate())
      });
  }

  schedulerUpdate() {

    const { scheduler, dhtmlx } = window;
    let i = 0;
    let prodProcessLineOptions = [];

    //scheduler config
    scheduler.xy.scale_height = 70;
    scheduler.locale.labels.dhx_cal_today_button = "Today";
    scheduler.locale.labels.section_custom = "Section";

    scheduler.config.details_on_create = true;
    scheduler.config.details_on_dblclick = true;

    scheduler.config.xml_date = "%Y-%m-%d %H:%i";
    scheduler.config.hour_date = "%h:%i %a";
    scheduler.config.limit_time_select = true;

    scheduler.config.first_hour = 0;
    scheduler.config.last_hour = 22;
    scheduler.config.time_step = 60;
    scheduler.config.select = false;

    function formatDate(date) {
      return moment(date).format("YYYY-MM-DD HH:mm")
    }

    let machineWorkCenter = this.state.machineWorkCenter;
    let manufacturingOrder = this.state.manufacturingOrder;

    //duplicate copy of machine data because we are adding some indirect fields to it
    let machine = this.state.machineModel;
    this.setState({
      machine: machine,
    })

    if (machine !== null) {
      for (i = 0; i < machine.length; i++) {
        let machineRecord = machine[i];
        machineRecord.label = machineRecord.serialNumber;
        machineRecord.key = machineRecord.id;
      }
    }

    scheduler.config.serverLists = {};
    scheduler.serverList("sections", machine);

    //adding needed field from other referenced data 
    let operationOrder = this.state.operationOrder;
    if (operationOrder && operationOrder !== null) {
      for (i = 0; i < operationOrder.length; i++) {
        let operationOrderRecord = operationOrder[i];

        this.state.manufacturingOrder.map(mOrder => {
          if (mOrder.id === operationOrderRecord.manufOrder.id) {
            operationOrderRecord.product = mOrder.product,
              operationOrderRecord.clientPartner = mOrder.clientPartner,
              operationOrderRecord.saleOrder = mOrder.saleOrder,
              operationOrderRecord.qty = mOrder.qty
            operationOrderRecord.prodProcess = mOrder.productProcess && mOrder.productProcess.id
          }
        })

        machineWorkCenter.map(mWorkCenter => {
          if (operationOrderRecord.machineWorkCenter !== null) {
            if (mWorkCenter.id === operationOrderRecord.machineWorkCenter.id) {
              operationOrderRecord.section_id = mWorkCenter.machine && mWorkCenter.machine.id;
            }
          }
        })
        operationOrderRecord.start_date = formatDate(operationOrderRecord.plannedStartDateT);
        operationOrderRecord.end_date = formatDate(operationOrderRecord.plannedEndDateT);
        operationOrderRecord.text = operationOrderRecord.operationName;
      }
    }

    //manforder options for lightbox
    let manufacturingOrderOptions = this.state.manufacturingOrder;
    if (manufacturingOrderOptions && manufacturingOrderOptions !== null) {
      for (i = 0; i < manufacturingOrderOptions.length; i++) {
        let project = manufacturingOrderOptions[i];
        if (project.manufOrderSeq !== null || project.manufOrderSeq !== undefined) {
          project.key = project.id;
          project.label = project.manufOrderSeq;
        }
      }
    }

    //month timeiline
    scheduler.config.serverLists["timeline"] = "sections";

    let step = 4;
    scheduler.createTimelineView({
      name: "timeline",
      x_unit: "hour",
      x_date: "%H",
      x_step: step,
      x_size: 288 / step,
      x_start: 0,
      x_length: 288 / step,
      y_unit: scheduler.serverList("sections"),
      y_property: "section_id",
      render: "bar",
      dy: 100,
      event_dy: 98,
      dx: 80,
      round_position: true,
      fit_events: true,
      section_autoheight: false,
      second_scale: {
        x_unit: "day",
        x_date: "%d %M"
      }
    });

    let update_select_options = function (select, options) {
      select.options.length = 0;
      for (let i = 0; i < options.length; i++) {
        let option = options[i];
        select[i] = new Option(option.name, option.id);
      }
    };

    function onTypeChange(e) {
      let trg = e.target || e.srcElement;
      let val = trg.value;
      let prodProcessId;

      manufacturingOrder.map(mOrder => {
        if (mOrder.id == val) {
          prodProcessId = mOrder.prodProcess && mOrder.prodProcess.id
        }
      })
      let data = {}
      let fields = ["id", "name"]
      data = {
        _domain: `self.prodProcess.id = ${prodProcessId}`,
        _domainContext: {},
      }

      this.service = new Service();
      this.service.getData("com.axelor.apps.production.db.ProdProcessLine", { data, fields }).then((body) => {
        body.json().then(result => {
          const { data } = result;
          prodProcessLineOptions = result.data
          update_select_options(scheduler.formSection('Operation').control, prodProcessLineOptions);
        });
      })
    };

    //lightbox section fields 
    scheduler.config.lightbox.sections = [
      { map_to: "text", name: "Operation Name", type: "textarea", height: 24, focus: true },
      { map_to: "priority", name: "Priority", type: "textarea", height: 24, focus: true },
      { map_to: "manuforder_id", name: "ManufOrder", type: "select", options: manufacturingOrderOptions, onchange: onTypeChange },
      { map_to: "prodProcessLine", name: "Operation", type: "select", options: prodProcessLineOptions },
      { map_to: "section_id", name: "Machine", type: "select", options: machine },
      { map_to: "auto", name: "time", height: 72, type: "calendar_time" },
    ];

    //rented hours for tooltip
    scheduler.calculateDuration = function (event) {
      return Math.round((event.end_date - event.start_date) / (1000 * 60 * 60));
    };

    function in_array(array, id) {
      return array.some(function (item) {
        return item.id === id;
      });
    }

    scheduler.templates.event_bar_text = function (start, end, event) {
      let time = scheduler.calculateDuration(event);
      let event_template;
      let result = in_array(operationOrder, event.id)
      if (result === false) {
        machine.map(m => {
          if (m.id == event.section_id) {
            event_template = m && m.serialNumber + ", " + time + " h.";
          }
        })
      }
      else {
        event_template = `${event.manufOrder && event.manufOrder.manufOrderSeq} - ${event.priority} - Qty: ${event.qty}
            <hr /> ${event.operationName}
            <br /> ${event.product && event.product.fullName}
            <br /> ${event.clientPartner && event.clientPartner.fullName}
            <br /> ${event.saleOrder && event.saleOrder.fullName}`
      }
      return event_template;
    }

    function long_date_template(start) {
      return scheduler.templates.event_date(start) + " " + scheduler.templates.day_date(start);
    }

    scheduler.templates.tooltip_text = function (start, end, event) {
      let lines = [];

      if (event !== null) {
        lines.push("<b>" + (event.manufOrder && event.manufOrder.manufOrderSeq) + " - " + event.priority + " - Qty : " + event.qty +
          " </b><br />" + event.operationName + "<br />" + (event.product && event.product.fullName) + "<br />"
          + (event.clientPartner && event.clientPartner.fullName) + "<br />" + (event.saleOrder && event.saleOrder.fullName));
        lines.push("From: " + long_date_template(start));
        lines.push("To: " + long_date_template(end));
      }
      return lines.join("<br>");
    };

    //event collision
    // scheduler.attachEvent("onEventCollision", function (ev, evs) {
    //   for (i = 0; i < evs.length; i++) {
    //     if (ev.section_id !== evs[i].section_id) continue;
    //     dhtmlx.alert('This machine is already rented for this date.')
    //   }
    //   return true;
    // });

    //y-unit template
    let label_template = function (key, label, section) {
      return `
        <div>
          <div style="position:relative">
            <div>${label}</div>
          </div>
        </div>`;
    };

    scheduler.templates.month_timeline_scale_label = label_template;
    scheduler.attachEvent("onSchedulerResize", function () { scheduler.setCurrentView(); });

    //init scheduler
    scheduler.init('scheduler_here', new Date(), "timeline");
    scheduler.parse(operationOrder, "json");

    function formatUTC(date) {
      return moment.utc(date);
    }

    //locally updates data
    const updateEventData = (id, record) => {
      scheduler.getEvent(id).text = record.operationName;
      scheduler.getEvent(id).manuforder_id = record.manufOrder.id;
      machineWorkCenter.map(mWorkCenter => {
        if (mWorkCenter.id === record.machineWorkCenter && record.machineWorkCenter.id) {
          scheduler.getEvent(id).section_id = mWorkCenter.machine && mWorkCenter.machine.id;
        }
      })
      scheduler.getEvent(id).start_date = formatUTC(record.plannedStartDateT)._d;
      scheduler.getEvent(id).end_date = formatUTC(record.plannedEndDateT)._d;
      scheduler.getEvent(id).priority = record.priority;
      // scheduler.getEvent(id).prodProcessLine = record.prodProcessLine.id;
      scheduler.updateEvent(id);
    }

    //On event creation
    scheduler.attachEvent("onEventSave", (id, ev, is_new) => {
      let priority = scheduler.formSection('Priority').getValue();
      let operationName = scheduler.formSection('Operation Name').getValue();
      let manufOrder = scheduler.formSection('ManufOrder').getValue();
      let prodProcessLine = scheduler.formSection('Operation').getValue();
      let time = scheduler.formSection('time').getValue();
      let machineWorkCenter = scheduler.formSection('Machine').getValue();

      const formPayload = {
        priority: priority,
        operationName: operationName,
        manufOrder: { id: manufOrder },
        // prodProcessLine: { id: prodProcessLine },
        plannedStartDateT: time.start_date,
        plannedEndDateT: time.end_date,
        machineWorkCenter: { id: machineWorkCenter }
      }

      if (is_new) {
        this.service.add('com.axelor.apps.production.db.OperationOrder', formPayload).then(res => {
          res.json().then(result => {
            const { data } = result;
            if (res.status === 200) {
              if (data && data.length) {
                const record = data[0];
                let new_event_id = record.id;
                scheduler.changeEventId(id, new_event_id);
                updateEventData(new_event_id, record);
              }
              console.log('Event is added');
            } else {
              console.log('Something going Wrong');
            }
          })
        });
      } else {
        updateEventData(id, formPayload);
      }
      scheduler.endLightbox(true, document.getElementsByClassName('dhx_cal_light_wide')[0]);
    });

    //event drag & drop 
    scheduler.attachEvent("onEventChanged", (id, ev) => {
      let manufOrder = scheduler.formSection('ManufOrder').getValue();
      let prodProcessLine = scheduler.formSection('Operation').getValue();

      const formPayload = {
        priority: ev.priority,
        operationName: ev.text,
        manufOrder: { id: manufOrder },
        // prodProcessLine: { id: prodProcessLine },
        plannedStartDateT: ev.start_date,
        plannedEndDateT: ev.end_date,
        machineWorkCenter: { id: ev.section_id }
      }

      this.service.getId('com.axelor.apps.production.db.OperationOrder', id).then(res => {
        res.json().then(result => {
          const { data } = result;
          if (data && data.length) {
            formPayload.version = data[0].version;
            this.service.update('com.axelor.apps.production.db.OperationOrder', formPayload, id).then(res => {
              res.json().then(result => {
                console.log('updated')
                const { data } = result;
                if (data && data.length) {
                  const record = data[0];
                  updateEventData(id, record);
                }
              })
            });
          }
        })
      });
    });

    //delete record
    scheduler.attachEvent("onEventDeleted", (id) => {
      this.service.delete('com.axelor.apps.production.db.OperationOrder', id).then(res => { console.log('deleted') });
    });
  }

  render() {
    return (
      <div className="App">
        <div id="scheduler_here" className="dhx_cal_container" style={{ width: '100%', height: window.innerHeight, marginRight: 10 }}>
          <div>
            <div className="dhx_cal_navline">
              <div className="dhx_cal_prev_button" />
              <div className="dhx_cal_next_button" />
              <div className="dhx_cal_today_button" role="button">TODAY</div>
              <div className="dhx_cal_date"></div>
            </div>
          </div>
          <div>
            <div className="dhx_cal_header" />
            <div className="dhx_cal_data" style={{ overflowX: 'scroll' }} />
          </div>
        </div>
      </div>
    );
  }
}