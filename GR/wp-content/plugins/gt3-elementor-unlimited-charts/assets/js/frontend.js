'use strict';


;(function (factory) {
	window.gt3Elementor = window.gt3Elementor || {};
	window.gt3Elementor.UnlimitedChartFrontend = window.gt3Elementor.UnlimitedChartFrontend || factory(window.jQuery);
})(function ($) {

	function UnlimitedChartFrontend() {
		if (!this || this.widgets !== UnlimitedChartFrontend.prototype.widgets) {
			return new UnlimitedChartFrontend()
		}

		this.initialize();
	}

	$.extend(UnlimitedChartFrontend.prototype, {
		widgets: {
			'unlimited-charts': 'UnlimitedCharts',
		},
		window: $(window),
		editMode: false,		
		initialize: function () {
			var that = this;

			if (typeof window.elementorFrontend !== 'undefined') {
				$.each(that.widgets, function (name, callback) {
					window.elementorFrontend.hooks.addAction('frontend/element_ready/' + name + '.default', that[callback].bind(that));
				})
			}
			if (typeof elementorFrontend !== 'undefined') {
				this.editMode = !!elementorFrontend.config.isEditMode;
			}


		},

		UnlimitedCharts: function ($scope) {			
			var chart = jQuery('.gt3_unlimited_chart_wrapper', $scope);
			var item = chart.find('.gt3_unlimited_chart');
			var type = chart.attr('data-chart-type');
			var data = JSON.parse(chart.attr('data-chart-data'));
			var options = JSON.parse(chart.attr('data-chart-options'));

			

			function chartBuild(){
				var myChart = new Chart(item, {
				    type: type,
				    data: data,
				    options: options
				});
			}

			var waypoint = new Waypoint({
	            element: chart,
	            offset: Waypoint.viewportHeight() - 250,
	            triggerOnce: true,
	            handler: function() {
	                chartBuild();
	                this.destroy();
	            }
		     });

		},
	});

	return UnlimitedChartFrontend;
});

jQuery(window).on('elementor/frontend/init', function () {
	window.gt3Elementor.UnlimitedChartFrontend = window.gt3Elementor.UnlimitedChartFrontend();
});


